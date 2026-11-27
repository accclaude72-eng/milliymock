// Builds a test booklet (HTML) + answer key (JSON) from a compact data module.
// The correct option is always written FIRST in the data; this script places it at a
// pseudo-random letter (seeded, reproducible) so answers don't cluster.
//
// Usage: node scripts/build-test.mjs content/tests/kimyo-mock-1.mjs
//   → writes content/<file>.html and content/<file>.key.json (both gitignored)
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const src = process.argv[2];
if (!src) throw new Error("Usage: node scripts/build-test.mjs <data.mjs>");
const T = (await import(pathToFileURL(path.resolve(src)).href)).default;

/* seeded RNG (mulberry32) */
let seed = [...T.file].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0), 7);
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const L = "ABCDEF";
const twoStage = T.o2?.length > 0;
// Total minutes for single-stage tests (Biology/Chemistry platform format = 100, Math/Physics = 150).
const minutes = T.minutes ?? 150;
const oLabel = ["biologiya", "kimyo"].includes(T.subjectCode) ? "O1" : "O";
const esc = (s) => s; // data is trusted, authored HTML

let n = 0;
const key = { y1: [], y2: {}, o1: {}, o2: {}, topics: {} };
const addTopic = (num, t) => (key.topics[t] ??= []).push(num);
const body = [];

body.push(`<div class="stage">${twoStage ? "1-bosqich <small>1–40 · 100 daqiqa</small>" : `Test topshiriqlari <small>1–${T.y1.length + T.y2.length + T.o.length} · ${minutes} daqiqa</small>`}</div>`);
body.push(`<div class="type">Y1 · bitta to‘g‘ri javobni belgilang</div>`);

// balanced letter targets: each letter appears ~equally, order shuffled
const targets = shuffle(Array.from({ length: T.y1.length }, (_, i) => i % 4));
T.y1.forEach(([topic, q, correct, ...wrong], i) => {
  n++;
  const opts = shuffle(wrong);
  opts.splice(targets[i], 0, correct);
  key.y1.push(`${n}${L[targets[i]]}`);
  addTopic(n, topic);
  body.push(`<section class="task" id="t${n}"><p class="q"><b>${n}.</b> ${esc(q)}</p>
<ul class="opts">${opts.map((o, k) => `<li><b>${L[k]}</b>${esc(o)}</li>`).join("")}</ul></section>`);
});

body.push(`<div class="type">Y2 · moslashtiring: har bir raqamga bitta harf (ikkita harf ortiqcha)</div>`);
for (const [topic, q, left, right] of T.y2) {
  n++;
  const order = shuffle(right.map((_, i) => i)); // order[k] = original index shown at letter k
  key.y2[n] = left.map((_, i) => L[order.indexOf(i)]);
  addTopic(n, topic);
  body.push(`<section class="task" id="t${n}"><p class="q"><b>${n}.</b> ${esc(q)}</p>
<div class="match"><ol class="left">${left.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
<ol class="right" type="A">${order.map((k) => `<li>${esc(right[k])}</li>`).join("")}</ol></div></section>`);
}

body.push(`<div class="type">${oLabel} · faqat javobni yozing (son, formula yoki bitta atama)</div>`);
for (const [topic, q, accepted, opt = {}] of T.o) {
  n++;
  key.o1[n] = { accepted, ...opt };
  addTopic(n, topic);
  body.push(`<section class="task" id="t${n}"><p class="q"><b>${n}.</b> ${esc(q)}</p></section>`);
}

if (twoStage) {
  body.push(`<div class="stage">2-bosqich <small>${n + 1}–${n + T.o2.length} · yozma ish · 80 daqiqa</small></div>
<p><i>Har bir masalada yechim usulini (M) va barcha hisob-kitoblarni (A) to‘liq yozing. Matn maydonidan foydalaning yoki qo‘lda yozilgan yechimni rasm/PDF qilib yuklang.</i></p>`);
  for (const [topic, pts, html, criteria] of T.o2) {
    n++;
    key.o2[n] = criteria.map(([id, component, max, label]) => ({ id, component, max, label }));
    const sum = criteria.reduce((s, c) => s + c[2], 0);
    if (sum !== pts) throw new Error(`Task ${n}: rubric sums to ${sum}, expected ${pts}`);
    addTopic(n, topic);
    body.push(`<section class="task o2" id="t${n}"><span class="pts">${pts} ball</span><p class="q"><b>${n}.</b> ${html}</p></section>`);
  }
}

const total = n;
const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;1,500&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--paper:#f3f0e8;--card:#fbfaf6;--ink:#141412;--muted:#66645c;--hair:#cdc8ba;--accent:#b8321a}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 "IBM Plex Sans",system-ui,sans-serif}
.book{max-width:820px;margin:0 auto;padding:28px 20px 60px}
header{border:1.5px solid var(--ink);background:var(--card);padding:18px 20px;margin-bottom:22px}
header h1{font:500 30px/1.1 Newsreader,serif;margin:4px 0 6px}
.eyebrow{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.rules{margin:10px 0 0;padding-left:18px;font-size:14px;color:var(--muted)}
.stage{font:500 22px Newsreader,serif;border-bottom:1.5px solid var(--ink);margin:34px 0 14px;padding-bottom:6px}
.stage small{font:500 11px "IBM Plex Mono",monospace;color:var(--accent);letter-spacing:.12em;margin-left:8px}
.type{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin:22px 0 8px}
.task{background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--ink);padding:14px 16px;margin:10px 0}
.q{margin:0 0 8px}.q>b:first-child{font-family:"IBM Plex Mono",monospace;margin-right:6px}
.opts{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
.opts li b{display:inline-grid;place-items:center;width:22px;height:22px;border:1.5px solid var(--accent);border-radius:50%;color:var(--accent);font:600 11px "IBM Plex Mono",monospace;margin-right:8px}
.match{display:grid;grid-template-columns:1fr 1fr;gap:16px}.match ol{margin:0;padding-left:22px}.match .right li::marker{font-weight:600}
.o2 .pts{float:right;font:500 12px "IBM Plex Mono",monospace;border:1px solid var(--ink);padding:1px 6px}
.mono{font-family:"IBM Plex Mono",monospace;letter-spacing:.04em}
.frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.92em;line-height:1.15}.frac>span:first-child{border-bottom:1px solid currentColor;padding:0 2px}
@media(max-width:600px){.opts,.match{grid-template-columns:1fr}}
</style></head>
<body><main class="book">
<header><div class="eyebrow">Milliy Mock · test kitobchasi</div><h1>${T.title}</h1>
<div class="eyebrow">${T.formatLine} · ${total} ta topshiriq · ${twoStage ? "100 + 80" : minutes} daqiqa</div>
<ul class="rules">${(T.rules ?? []).map((r) => `<li>${r}</li>`).join("")}</ul></header>
${body.join("\n")}
</main></body></html>`;

const outBase = path.join("content", T.file);
writeFileSync(`${outBase}.html`, html);
writeFileSync(
  `${outBase}.key.json`,
  JSON.stringify(
    { title: T.title, description: T.description, subjectCode: T.subjectCode, y1: key.y1.join(" "), topics: key.topics, y2: key.y2, o1: key.o1, o2: key.o2 },
    null,
    2,
  ),
);
console.log(`✓ ${outBase}.html (${total} tasks) + key`);
