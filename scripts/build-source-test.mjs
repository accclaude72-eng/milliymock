// Builds a booklet (HTML) + answer key (JSON) from a test that already exists on paper
// (PDF / DOCX from a teacher). Unlike build-test.mjs, options keep their ORIGINAL order and
// letters, because answers like "A) 1-c" refer to numbered items in the question.
//
// Usage: node scripts/build-source-test.mjs content/tests/<data>.mjs
//   → content/<file>.html + content/<file>.key.json  (both gitignored: they hold the key)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const src = process.argv[2];
if (!src) throw new Error("Usage: node scripts/build-source-test.mjs <data.mjs>");
const T = (await import(pathToFileURL(path.resolve(src)).href)).default;
const L = "ABCDEFGHIJ";

/** Images: { "name": "path/to/file.png" } → inlined as data URIs (the booklet bucket is private). */
const img = (name) => {
  const p = T.images?.[name];
  if (!p) throw new Error(`image ${name} missing`);
  return `data:image/${path.extname(p).slice(1)};base64,${readFileSync(p).toString("base64")}`;
};
const html = (s) => s.replace(/\{img:([a-z0-9_-]+)\}/gi, (_, n) => `<img src="${img(n)}" alt="" class="fig">`);

const key = { y1: [], y2: {}, o1: {}, o2: {}, topics: {}, structure: { y2: {} }, review: [] };
const addTopic = (n, t) => (key.topics[t] ??= []).push(n);
const body = [];
let lastType = null;
const TYPE_LINE = {
  Y1: "Y1 · bitta to‘g‘ri javobni belgilang",
  Y2: "Y2 · har bir topshiriqqa mos javobni (A–F) tanlang",
  O1: "O1 · faqat javobni yozing (son yoki atama)",
  O2: "O2 · yozma ish: yechimni to‘liq yozing",
};

for (const t of T.tasks) {
  if (t.before) body.push(`<div class="ctx">${html(t.before)}</div>`);
  if (t.type !== lastType) {
    body.push(`<div class="type">${TYPE_LINE[t.type]}</div>`);
    lastType = t.type;
  }
  addTopic(t.n, t.topic);
  key.review.push({ n: t.n, label: t.label ?? String(t.n), answer: t.correct ?? t.accepted?.[0] ?? (t.criteria ? "rubrika" : "—"), why: t.why ?? "", confidence: t.confidence ?? "yuqori" });
  const label = t.label ?? `${t.n}.`;
  if (t.type === "Y1") {
    if (!L.slice(0, t.options.length).includes(t.correct)) throw new Error(`Task ${t.n}: bad correct letter`);
    key.y1.push(`${t.n}${t.correct}`);
    body.push(`<section class="task" id="t${t.n}"><p class="q"><b>${label}</b> ${html(t.q)}</p>
<ul class="opts${t.wide ? " wide" : ""}">${t.options.map((o, k) => `<li><b>${L[k]}</b>${html(o)}</li>`).join("")}</ul></section>`);
  } else if (t.type === "Y2") {
    key.y2[t.n] = [t.correct];
    key.structure.y2[t.n] = { left: 1, right: t.right.length };
    body.push(`<section class="task" id="t${t.n}"><p class="q"><b>${label}</b> ${html(t.q)}</p>
<ol class="right" type="A">${t.right.map((o) => `<li>${html(o)}</li>`).join("")}</ol></section>`);
  } else if (t.type === "O1") {
    if (t.accepted?.length) key.o1[t.n] = { accepted: t.accepted, ...(t.unit ? { unit: t.unit } : {}), ...(t.tolerance ? { tolerance: t.tolerance } : {}) };
    body.push(`<section class="task" id="t${t.n}"><p class="q"><b>${label}</b> ${html(t.q)}</p></section>`);
  } else if (t.type === "O2") {
    key.o2[t.n] = t.criteria.map(([id, component, max, lbl]) => ({ id, component, max, label: lbl }));
    body.push(`<section class="task o2" id="t${t.n}"><span class="pts">${t.pts} ball</span><p class="q"><b>${label}</b> ${html(t.q)}</p></section>`);
  }
}

const out = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;1,500&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--paper:#f3f0e8;--card:#fbfaf6;--ink:#141412;--muted:#66645c;--hair:#cdc8ba;--accent:#b8321a}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 "IBM Plex Sans",system-ui,sans-serif}
.book{max-width:860px;margin:0 auto;padding:28px 20px 60px}
header{border:1.5px solid var(--ink);background:var(--card);padding:18px 20px;margin-bottom:22px}
header h1{font:500 30px/1.1 Newsreader,serif;margin:4px 0 6px}
.eyebrow{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.rules{margin:10px 0 0;padding-left:18px;font-size:14px;color:var(--muted)}
.type{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin:26px 0 8px}
.ctx{background:#fff;border:1.5px dashed var(--ink);padding:12px 16px;margin:18px 0 6px}
.task{background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--ink);padding:14px 16px;margin:10px 0}
.q{margin:0 0 8px}.q>b:first-child{font-family:"IBM Plex Mono",monospace;margin-right:6px}
.opts{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}.opts.wide{grid-template-columns:1fr}
.opts li b{display:inline-grid;place-items:center;width:22px;height:22px;border:1.5px solid var(--accent);border-radius:50%;color:var(--accent);font:600 11px "IBM Plex Mono",monospace;margin-right:8px}
.right{margin:6px 0 0;padding-left:24px;columns:2}.right li::marker{font-weight:600}
table.t{border-collapse:collapse;margin:8px 0;font-size:14px}table.t td,table.t th{border:1px solid var(--hair);padding:4px 8px;vertical-align:top}
.fig{display:block;max-width:100%;height:auto;margin:8px 0;border:1px solid var(--hair);background:#fff}
.o2 .pts{float:right;font:500 12px "IBM Plex Mono",monospace;border:1px solid var(--ink);padding:1px 6px}
.src{margin-top:28px;font-size:12px;color:var(--muted)}
@media(max-width:600px){.opts,.right{grid-template-columns:1fr;columns:1}}
</style></head>
<body><main class="book">
<header><div class="eyebrow">Milliy Mock · test kitobchasi</div><h1>${T.title}</h1>
<div class="eyebrow">${T.formatLine}</div>
<ul class="rules">${(T.rules ?? []).map((r) => `<li>${r}</li>`).join("")}</ul></header>
${body.join("\n")}
${T.sourceNote ? `<p class="src">${T.sourceNote}</p>` : ""}
</main></body></html>`;

const base = path.join("content", T.file);
writeFileSync(`${base}.html`, out);
writeFileSync(
  `${base}.key.json`,
  JSON.stringify(
    {
      title: T.title,
      description: T.description,
      subjectCode: T.subjectCode,
      formatId: T.formatId,
      mode: T.mode ?? "full",
      range: T.range ?? null,
      timed: T.timed ?? true,
      minutes: T.minutes ?? null,
      y1: key.y1.join(" "),
      topics: key.topics,
      y2: key.y2,
      o1: key.o1,
      o2: key.o2,
      structure: key.structure,
      review: key.review,
    },
    null,
    2,
  ),
);
console.log(`✓ ${base}.html (${T.tasks.length} tasks, ${(out.length / 1024).toFixed(0)} KB) + key`);
