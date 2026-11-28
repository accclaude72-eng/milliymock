/**
 * Extracts individual questions from a Milliy Mock booklet (pure, no I/O — unit tested).
 *
 * Booklets mark each task as <section class="task" id="tN"> with the stem in <p class="q">
 * and options as <ul class="opts"><li><b>A</b>…</li></ul> (or <button class="opt" data-opt="A">).
 * Output HTML is sanitised to a tiny allowlist, so it is safe to render with innerHTML.
 */

export interface ParsedQuestion {
  n: number;
  stem: string;
  options: { letter: string; html: string }[];
  /** The task contained a figure / diagram we dropped (svg, canvas…). */
  hasFigure: boolean;
}

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "sub", "sup", "br", "small", "span"]);

/** Allowlist sanitiser: keeps simple inline formatting and data: images; drops everything else. */
export function sanitizeFragment(html: string): { html: string; hasFigure: boolean } {
  let hasFigure = false;
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(svg|canvas|math)\b[\s\S]*?<\/\1\s*>/gi, () => {
      hasFigure = true;
      return " [rasm] ";
    });
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (tag, name: string, attrs: string) => {
    const t = name.toLowerCase();
    const closing = tag.startsWith("</");
    if (t === "img") {
      const src = /\bsrc\s*=\s*"(data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)"/i.exec(attrs)?.[1];
      if (!src) {
        hasFigure = true;
        return " [rasm] ";
      }
      return `<img src="${src}" alt="" style="max-width:100%;height:auto;vertical-align:middle">`;
    }
    if (!ALLOWED.has(t)) return t === "p" || t === "div" || t === "li" ? (closing ? " " : " ") : "";
    if (t === "br") return "<br>";
    return closing ? `</${t}>` : `<${t}>`;
  });
  // Normalise whitespace and decode nothing (entities stay entities — still safe).
  s = s.replace(/\s+/g, " ").trim();
  return { html: s, hasFigure };
}

const strip = (h: string) => h.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function parseBooklet(html: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  const re = /<section\b[^>]*\bclass="[^"]*\btask\b[^"]*"[^>]*\bid="t(\d{1,3})"[^>]*>([\s\S]*?)<\/section>/g;
  for (const m of html.matchAll(re)) {
    const n = Number(m[1]);
    const body = m[2];
    const q = /<p\b[^>]*\bclass="[^"]*\bq\b[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(body);
    if (!q) continue;
    // Drop the leading "<b>12.</b>" number.
    const stemRaw = q[1].replace(/^\s*<b>\s*\d{1,3}\.?\s*<\/b>\s*/, "");
    const stem = sanitizeFragment(stemRaw);
    let hasFigure = stem.hasFigure || /<(svg|canvas|img)\b/i.test(body.replace(q[0], ""));
    const options: ParsedQuestion["options"] = [];
    for (const li of body.matchAll(/<li\b[^>]*>\s*<b>\s*([A-J])\s*<\/b>([\s\S]*?)<\/li>/g)) {
      const o = sanitizeFragment(li[2]);
      hasFigure ||= o.hasFigure;
      options.push({ letter: li[1], html: o.html });
    }
    if (!options.length) {
      for (const b of body.matchAll(/<button\b[^>]*\bdata-opt="([A-J])"[^>]*>([\s\S]*?)<\/button>/g)) {
        const inner = b[2].replace(/^\s*<b>\s*[A-J]\s*<\/b>/, "");
        const o = sanitizeFragment(inner);
        if (strip(o.html)) options.push({ letter: b[1], html: o.html });
      }
    }
    if (!strip(stem.html)) continue;
    out.push({ n, stem: stem.html, options, hasFigure });
  }
  return out;
}
