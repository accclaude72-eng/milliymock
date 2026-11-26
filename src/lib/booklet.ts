"use client";

/**
 * Client-side processing of an uploaded HTML test booklet, BEFORE it is stored:
 *  - robust charset detection (BOM / <meta charset> / Windows-1251 fallback) → always UTF-8 output
 *  - inlines local images & stylesheets the admin selected alongside the HTML (Word "Save as Web Page" exports)
 *  - removes things that must never run (meta refresh, <base>, <object>/<embed>, optionally scripts)
 *  - sanity checks: empty file, missing images, question numbering vs. the exam format
 * The result is rendered for candidates in a sandboxed, cross-origin iframe.
 */

export const MAX_BOOKLET_BYTES = 50 * 1024 * 1024;

export interface BookletReport {
  html: string;
  bytes: number;
  title: string;
  charset: string;
  errors: string[];
  warnings: string[];
  stats: {
    images: number;
    inlinedImages: number;
    externalImages: number;
    missingImages: string[];
    scripts: number;
    removedScripts: boolean;
    inlinedCss: number;
    textLength: number;
    foundNumbers: number[];
    missingNumbers: number[];
  };
}

function baseName(url: string): string {
  let u = url.split("#")[0].split("?")[0].replace(/\\/g, "/");
  try {
    u = decodeURIComponent(u);
  } catch {
    /* keep raw */
  }
  return (u.split("/").pop() ?? "").trim().toLowerCase();
}

function isExternal(url: string): boolean {
  return /^(https?:)?\/\//i.test(url);
}

function readAsDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function sniffCharset(buf: ArrayBuffer): { charset: string; offset: number } {
  const b = new Uint8Array(buf);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { charset: "utf-8", offset: 3 };
  if (b[0] === 0xff && b[1] === 0xfe) return { charset: "utf-16le", offset: 2 };
  if (b[0] === 0xfe && b[1] === 0xff) return { charset: "utf-16be", offset: 2 };
  const head = new TextDecoder("latin1").decode(b.slice(0, 8192));
  const m = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i);
  return { charset: m ? m[1].toLowerCase() : "utf-8", offset: 0 };
}

function decode(buf: ArrayBuffer): { text: string; charset: string } {
  const { charset, offset } = sniffCharset(buf);
  const bytes = new Uint8Array(buf, offset);
  let label = charset;
  let text: string;
  try {
    text = new TextDecoder(label).decode(bytes);
  } catch {
    label = "utf-8";
    text = new TextDecoder("utf-8").decode(bytes);
  }
  // Undeclared legacy Cyrillic (common in Word exports) shows up as replacement chars in UTF-8.
  if (label === "utf-8") {
    const bad = (text.match(/�/g) ?? []).length;
    if (bad > 20 && bad / Math.max(1, text.length) > 0.002) {
      const alt = new TextDecoder("windows-1251").decode(bytes);
      if ((alt.match(/�/g) ?? []).length < bad) return { text: alt, charset: "windows-1251" };
    }
  }
  return { text, charset: label };
}

export async function processBooklet(
  htmlFile: File,
  assets: File[],
  expectedNumbers: number[],
  opts: { removeScripts: boolean },
): Promise<BookletReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/\.html?$/i.test(htmlFile.name)) errors.push("Asosiy fayl .html yoki .htm kengaytmali bo‘lishi kerak.");
  if (htmlFile.size > MAX_BOOKLET_BYTES) errors.push("HTML fayl 50 MB dan katta.");

  const { text, charset } = decode(await htmlFile.arrayBuffer());
  const doc = new DOMParser().parseFromString(text, "text/html");

  // --- remove dangerous / breaking elements
  doc.querySelectorAll("meta[http-equiv]").forEach((m) => {
    const eq = (m.getAttribute("http-equiv") ?? "").toLowerCase();
    if (eq === "refresh" || eq === "content-type" || eq === "set-cookie") m.remove();
  });
  doc.querySelectorAll("meta[charset]").forEach((m) => m.remove());
  const bases = doc.querySelectorAll("base");
  if (bases.length) warnings.push("<base> tegi olib tashlandi (havolalarni buzishi mumkin edi).");
  bases.forEach((b) => b.remove());
  const embeds = doc.querySelectorAll("object, embed, applet");
  if (embeds.length) warnings.push(`${embeds.length} ta <object>/<embed> elementi xavfsizlik uchun olib tashlandi.`);
  embeds.forEach((e) => e.remove());

  const scripts = doc.querySelectorAll("script");
  const scriptCount = scripts.length;
  if (opts.removeScripts) {
    scripts.forEach((s) => s.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        else if (/^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      }
    });
  } else if (scriptCount) {
    warnings.push(`${scriptCount} ta skript saqlandi. Ular nomzodga izolyatsiyalangan (sandbox) oynada ishlaydi va platformaga kira olmaydi.`);
  }

  // --- assets
  const assetMap = new Map<string, File>();
  for (const a of assets) assetMap.set(a.name.toLowerCase(), a);
  const dataCache = new Map<string, string>();
  const toData = async (f: File) => {
    const k = f.name.toLowerCase();
    if (!dataCache.has(k)) dataCache.set(k, await readAsDataUrl(f));
    return dataCache.get(k)!;
  };

  let images = 0;
  let inlined = 0;
  let external = 0;
  const missing = new Set<string>();

  for (const el of Array.from(doc.querySelectorAll("img[src], image[href], source[src], input[type=image][src]"))) {
    const attr = el.hasAttribute("src") ? "src" : "href";
    const src = (el.getAttribute(attr) ?? "").trim();
    if (!src) continue;
    images++;
    if (/^data:/i.test(src)) continue;
    if (isExternal(src)) {
      external++;
      continue;
    }
    const f = assetMap.get(baseName(src));
    if (f) {
      el.setAttribute(attr, await toData(f));
      el.removeAttribute("srcset");
      inlined++;
    } else missing.add(src);
  }
  // VML (Word) image references
  for (const el of Array.from(doc.getElementsByTagName("v:imagedata"))) {
    const src = el.getAttribute("src") ?? "";
    const f = src && !isExternal(src) && !/^data:/i.test(src) ? assetMap.get(baseName(src)) : undefined;
    if (f) el.setAttribute("src", await toData(f));
  }

  // CSS: inline local stylesheets, and rewrite url(...) references in <style> and style=""
  let inlinedCss = 0;
  for (const link of Array.from(doc.querySelectorAll("link[rel~=stylesheet][href]"))) {
    const href = link.getAttribute("href") ?? "";
    if (isExternal(href)) continue;
    const f = assetMap.get(baseName(href));
    if (f) {
      const style = doc.createElement("style");
      style.textContent = await f.text();
      link.replaceWith(style);
      inlinedCss++;
    } else {
      warnings.push(`Uslublar fayli topilmadi: ${href} — dizayn biroz farq qilishi mumkin.`);
      link.remove();
    }
  }
  const rewriteUrls = async (css: string): Promise<string> => {
    const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let out = "";
    let last = 0;
    for (const m of Array.from(css.matchAll(re))) {
      out += css.slice(last, m.index);
      const u = m[2].trim();
      const f = !/^data:/i.test(u) && !isExternal(u) ? assetMap.get(baseName(u)) : undefined;
      out += f ? `url("${await toData(f)}")` : m[0];
      last = (m.index ?? 0) + m[0].length;
    }
    return out + css.slice(last);
  };
  for (const st of Array.from(doc.querySelectorAll("style"))) if (st.textContent?.includes("url(")) st.textContent = await rewriteUrls(st.textContent);
  for (const el of Array.from(doc.querySelectorAll("[style*='url(']"))) el.setAttribute("style", await rewriteUrls(el.getAttribute("style") ?? ""));
  for (const el of Array.from(doc.querySelectorAll("[background]"))) {
    const u = el.getAttribute("background") ?? "";
    const f = u && !isExternal(u) && !/^data:/i.test(u) ? assetMap.get(baseName(u)) : undefined;
    if (f) el.setAttribute("background", await toData(f));
  }

  if (missing.size) {
    errors.push(
      `${missing.size} ta rasm topilmadi: ${Array.from(missing).slice(0, 6).map(baseName).join(", ")}${missing.size > 6 ? "…" : ""}. Rasmlarni HTML bilan birga tanlang (Word eksportida “…_files” papkasidagi fayllar).`,
    );
  }
  if (external) warnings.push(`${external} ta rasm internetdagi manzildan yuklanadi — nomzodda internet bo‘lmasa ko‘rinmasligi mumkin.`);

  // --- head normalization
  const head = doc.head ?? doc.documentElement.insertBefore(doc.createElement("head"), doc.body);
  const meta = doc.createElement("meta");
  meta.setAttribute("charset", "utf-8");
  head.insertBefore(meta, head.firstChild);
  if (!doc.querySelector("meta[name=viewport]")) {
    const vp = doc.createElement("meta");
    vp.setAttribute("name", "viewport");
    vp.setAttribute("content", "width=device-width, initial-scale=1");
    meta.after(vp);
  }
  const guard = doc.createElement("style");
  guard.setAttribute("data-milliy-mock", "");
  guard.textContent = "img,svg,video{max-width:100%;height:auto}table{max-width:100%}body{overflow-wrap:break-word}";
  head.appendChild(guard);

  // --- content checks
  const bodyText = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  if (bodyText.length < 40 && images === 0) errors.push("Fayl deyarli bo‘sh — test matni topilmadi.");

  const found = new Set<number>();
  const blocks = Array.from(doc.body?.querySelectorAll("p, div, li, td, th, h1, h2, h3, h4, h5, h6, span, b, strong") ?? []);
  const numRe = /^\s*(\d{1,3})\s*[.)\-–]\s*/;
  for (const el of blocks) {
    const t = el.textContent ?? "";
    const m = t.match(numRe);
    if (m) found.add(Number(m[1]));
  }
  for (const m of bodyText.matchAll(/(?:^|\s)(\d{1,3})\s*[.)]\s+(?=\S)/g)) found.add(Number(m[1]));
  // Ordered lists numbered automatically by the browser
  for (const ol of Array.from(doc.querySelectorAll("ol"))) {
    const start = Number(ol.getAttribute("start") ?? "1") || 1;
    Array.from(ol.children).forEach((li, i) => li.tagName === "LI" && found.add(start + i));
  }
  const missingNumbers = expectedNumbers.filter((n) => !found.has(n));
  if (expectedNumbers.length && missingNumbers.length) {
    const ratio = missingNumbers.length / expectedNumbers.length;
    const msg = `Matnda quyidagi topshiriq raqamlari aniqlanmadi: ${compactRanges(missingNumbers)}. Kitobcha tuzilishini oldindan ko‘rishda tekshiring.`;
    if (ratio > 0.5) warnings.push(msg + " (Raqamlar rasm yoki jadval ichida bo‘lsa, bu normal holat.)");
    else warnings.push(msg);
  }

  const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  const bytes = new Blob([html]).size;
  if (bytes > MAX_BOOKLET_BYTES) errors.push(`Rasmlar joylangandan so‘ng fayl hajmi ${(bytes / 1024 / 1024).toFixed(1)} MB — 50 MB dan oshmasligi kerak. Rasmlarni siqing.`);

  return {
    html,
    bytes,
    title: (doc.title || htmlFile.name.replace(/\.html?$/i, "")).trim().slice(0, 160),
    charset,
    errors,
    warnings,
    stats: {
      images,
      inlinedImages: inlined,
      externalImages: external,
      missingImages: Array.from(missing),
      scripts: scriptCount,
      removedScripts: opts.removeScripts,
      inlinedCss,
      textLength: bodyText.length,
      foundNumbers: Array.from(found).sort((a, b) => a - b),
      missingNumbers,
    },
  };
}

export function compactRanges(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? String(s[i]) : `${s[i]}–${s[j]}`);
    i = j;
  }
  return out.join(", ");
}
