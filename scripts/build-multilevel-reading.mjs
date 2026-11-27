// Converts an extracted Multilevel (CEFR) Reading paper into a Milliy Mock booklet + answer key.
//
//   1) python scripts/extract-multilevel-pdf.py "<paper.pdf>" content/<name>      (text lines, key, advert images)
//   2) node scripts/build-multilevel-reading.mjs content/<name> "<Title>"
//      → content/<name>.html + content/<name>.key.json  (publish with scripts/publish-test.mjs)
//
// Targets the standard 5-part Reading layout (1–6 gap fill, 7–14 adverts, 15–20 headings,
// 21–29 MCQ + True/False/No Information, 30–35 summary + MCQ). It also cross-checks the answer
// key against the text and stops on anything inconsistent.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const [dir, titleArg] = process.argv.slice(2);
if (!dir) {
  console.error('Usage: node scripts/build-multilevel-reading.mjs content/<name> "<Title>"');
  process.exit(1);
}
const name = path.basename(dir);
const title = titleArg ?? "Multilevel Reading — Full Mock";
const lines = JSON.parse(readFileSync(path.join(dir, "lines.json"), "utf8"));
const rawKey = JSON.parse(readFileSync(path.join(dir, "key.json"), "utf8"));

/* ---------------------------------------------------------------- helpers */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Cyrillic look-alikes used as option letters in the source (В → B, А → A, С → C)
const latin = (s) => s.replace(/^[А]/, "A").replace(/^[В]/, "B").replace(/^[С]/, "C");
const join = (ls) => ls.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
const gap = (n) => `<span class="gap"><b>${n}</b></span>`;
const fail = (msg) => {
  console.error("✗ " + msg);
  process.exit(1);
};
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);

// split into parts by the "PART n" headings
const parts = {};
let cur = null;
for (const l of lines) {
  const m = /^PART (\d)$/.exec(l.text);
  if (m) {
    cur = Number(m[1]);
    parts[cur] = [];
    continue;
  }
  if (cur) parts[cur].push(l);
}
for (let p = 1; p <= 5; p++) if (!parts[p]?.length) fail(`PART ${p} not found`);

// leading italic lines = instructions (a new block starts a new instruction paragraph)
function takeInstructions(ls) {
  const out = [];
  while (ls.length && ls[0].italic) {
    if (ls[0].blockStart || !out.length) out.push([]);
    out[out.length - 1].push(ls.shift());
  }
  return out.map(join);
}
const instr = (arr) => arr.map((t) => `<p class="instr">${esc(t)}</p>`).join("");

/* ---------------------------------------------------------------- PART 1 */
const p1 = [...parts[1]];
const p1Instr = takeInstructions(p1);
let p1Text = esc(join(p1));
const p1Gaps = [...p1Text.matchAll(/\((\d+)\)_{3,}/g)].map((m) => m[1]);
p1Text = p1Text.replace(/\((\d+)\)_{3,}/g, (_, n) => gap(n));
check(p1Gaps.join() === "1,2,3,4,5,6", `Part 1 gaps: ${p1Gaps}`);

/* ---------------------------------------------------------------- PART 2 */
const p2 = [...parts[2]];
const p2Instr = takeInstructions(p2);
const statements = p2.map((l) => /^([A-J])\)\s*(.+)$/.exec(latin(l.text))).filter(Boolean);
check(statements.map((m) => m[1]).join("") === "ABCDEFGHIJ", "Part 2 statements A–J");
const adverts = [];
for (let n = 7; n <= 14; n++) {
  const f = path.join(dir, `advert_${n}.png`);
  if (!existsSync(f)) fail(`missing ${f}`);
  adverts.push([n, `data:image/png;base64,${readFileSync(f).toString("base64")}`]);
}

/* ---------------------------------------------------------------- PART 3 */
const p3 = [...parts[3]];
const p3Instr = takeInstructions(p3);
const headings = [];
const p3Items = [];
let p3Title = "";
const paras3 = [];
for (const l of p3) {
  let m;
  if (/^List of Headings/i.test(l.text)) continue;
  if ((m = /^([A-H])\)\s*(.+)$/.exec(latin(l.text)))) headings.push([m[1], m[2]]);
  else if ((m = /^(\d+)\.\s*Paragraph\s+([IVX]+)$/.exec(l.text))) p3Items.push([m[1], m[2]]);
  else if (l.bold && !paras3.length) p3Title = l.text;
  else if ((m = /^(I|II|III|IV|V|VI|VII|VIII)\s+(.+)$/.exec(l.text)) && l.x0 < 60) paras3.push([m[1], [{ text: m[2] }]]);
  else if (paras3.length) paras3[paras3.length - 1][1].push(l);
}
check(headings.length === 8, `Part 3 headings: ${headings.length}`);
check(p3Items.length === 6 && paras3.length === 6, `Part 3 items ${p3Items.length}, paragraphs ${paras3.length}`);

/* ---------------------------------------------------------------- PART 4 */
const p4 = [...parts[4]];
const p4Instr = takeInstructions(p4);
// passage = blocks until the next italic instruction; a block that starts a new page right
// after a full-width line is the same paragraph continuing
const paras4 = [];
let prev = null;
while (p4.length && !p4[0].italic) {
  const l = p4.shift();
  const continues = prev && l.page !== prev.page && prev.x1 > 530;
  if (!paras4.length || (l.blockStart && !continues)) paras4.push([]);
  paras4[paras4.length - 1].push(l);
  prev = l;
}
function parseQuestions(ls, qRe, optRe) {
  const qs = [];
  for (const l of ls) {
    let m;
    const t = latin(l.text);
    if ((m = qRe.exec(t))) qs.push({ n: m[1], q: m[2], opts: [] });
    else if (/^A\)\s*True\s+B\)\s*False\s+C\)\s*No(t)?\s+(Information|Given)$/i.test(t)) qs[qs.length - 1].tfni = true;
    else if ((m = optRe.exec(t)) && qs.length) qs[qs.length - 1].opts.push([m[1], m[2]]);
    else if (qs.length) {
      const q = qs[qs.length - 1];
      if (q.opts.length) q.opts[q.opts.length - 1][1] += " " + t;
      else q.q += " " + t;
    }
  }
  return qs;
}
const p4BlockA = takeInstructions(p4);
const mcq4Lines = [];
while (p4.length && !p4[0].italic) mcq4Lines.push(p4.shift());
const mcq4 = parseQuestions(mcq4Lines, /^(\d+)\.\s+(.+)$/, /^([A-D])\s+(.+)$/);
const p4BlockB = takeInstructions(p4);
const tf = parseQuestions(p4, /^(\d+)\s+(.+)$/, /^$^/);
check(mcq4.map((q) => q.n).join() === "21,22,23,24" && mcq4.every((q) => q.opts.length === 4), "Part 4 MCQ 21–24 with A–D");
check(tf.map((q) => q.n).join() === "25,26,27,28,29" && tf.every((q) => q.tfni), "Part 4 True/False/No Information 25–29");

/* ---------------------------------------------------------------- PART 5 */
const p5 = [...parts[5]];
const p5Instr = takeInstructions(p5);
const p5Title = p5[0]?.bold ? p5.shift().text : "";
const p5Sub = [];
while (p5.length && p5[0].italic) p5Sub.push(p5.shift());
const paras5 = [[]];
while (p5.length && !p5[0].italic) {
  const l = p5.shift();
  paras5[paras5.length - 1].push(l);
  // paragraph ends on a short line, or a closing quote that stops short of the margin
  if (l.x1 < 470 || (/[.!?]'$/.test(l.text) && l.x1 < 550)) paras5.push([]);
}
if (!paras5[paras5.length - 1].length) paras5.pop();
const sumInstr = takeInstructions(p5);
const sumTitle = p5[0]?.bold ? p5.shift().text : "";
const sumLines = [];
while (p5.length && !p5[0].italic) sumLines.push(p5.shift());
let sumText = esc(join(sumLines));
const sumGaps = [...sumText.matchAll(/(\d{2})\s*_{3,}\s*\.?/g)].map((m) => m[1]);
sumText = sumText.replace(/(\d{2})\s*_{3,}\s*\.?/g, (_, n) => gap(n));
check(sumGaps.join() === "30,31,32,33", `Part 5 gaps: ${sumGaps}`);
const mcq5Instr = takeInstructions(p5);
const mcq5 = parseQuestions(p5, /^(\d{2})\s+(.+)$/, /^([A-D])\)\s*(.+)$/);
check(mcq5.map((q) => q.n).join() === "34,35" && mcq5.every((q) => q.opts.length === 4), "Part 5 MCQ 34–35");

/* ---------------------------------------------------------------- answer key analysis */
const key = {};
for (const [n, v] of Object.entries(rawKey)) key[n] = latin(v.trim());
for (let n = 1; n <= 35; n++) if (!key[n]) problems.push(`key: no answer for ${n}`);
const letterRange = (from, to, letters) => {
  for (let n = from; n <= to; n++) check(new RegExp(`^[${letters}]$`).test(key[n] ?? ""), `key ${n} = "${key[n]}" is not one of ${letters}`);
};
letterRange(7, 14, "A-J");
letterRange(15, 20, "A-H");
letterRange(21, 24, "A-D");
letterRange(25, 29, "A-C");
letterRange(34, 35, "A-D");
const uniq = (from, to) => {
  const v = [];
  for (let n = from; n <= to; n++) v.push(key[n]);
  check(new Set(v).size === v.length, `key ${from}–${to} reuses a letter (${v.join(" ")}) — each option may be used once`);
};
uniq(7, 14);
uniq(15, 20);
// Part 1: the word must appear elsewhere in the text (the task says so)
const p1Plain = join(parts[1].filter((l) => !l.italic)).replace(/\((\d+)\)_{3,}/g, " ").toLowerCase();
for (let n = 1; n <= 6; n++) {
  const w = (key[n] ?? "").toLowerCase();
  check(/^[a-z'-]+$/.test(w) && new RegExp(`\\b${w}\\b`).test(p1Plain), `key ${n} "${key[n]}" is not a single word found in the Part 1 text`);
}
// Part 5 summary: one word, taken from the passage
const p5Plain = paras5.flat().map((l) => l.text).join(" ").toLowerCase();
for (let n = 30; n <= 33; n++) {
  const w = (key[n] ?? "").toLowerCase();
  check(/^[a-z0-9'-]+$/.test(w) && p5Plain.includes(w), `key ${n} "${key[n]}" is not one word from the Part 5 passage`);
}
if (problems.length) fail("answer key / layout problems:\n  " + problems.join("\n  "));

/* ---------------------------------------------------------------- HTML */
const opts = (q) => `<ul class="opts">${q.opts.map(([L, t]) => `<li><b>${L}</b>${esc(t)}</li>`).join("")}</ul>`;
const part = (n, label, range) => `<h2 class="stage">Part ${n}<small>${label} · ${range}</small></h2>`;
const body = [];

body.push(part(1, "Gap filling", "1–6"), instr(p1Instr), `<article class="passage"><p>${p1Text}</p></article>`);

body.push(
  part(2, "Matching", "7–14"),
  instr(p2Instr),
  `<div class="task"><ol class="letters">${statements.map((m) => `<li><b>${m[1]}</b>${esc(m[2])}</li>`).join("")}</ol></div>`,
  `<div class="ads">${adverts.map(([n, src]) => `<figure class="ad" id="t${n}"><figcaption>${n}</figcaption><img src="${src}" alt="Text ${n}"></figure>`).join("")}</div>`,
);

body.push(
  part(3, "Headings", "15–20"),
  instr(p3Instr),
  `<div class="task"><p class="type">List of headings</p><ol class="letters">${headings.map(([L, t]) => `<li><b>${L}</b>${esc(t)}</li>`).join("")}</ol></div>`,
  `<article class="passage">${p3Title ? `<h3>${esc(p3Title)}</h3>` : ""}${paras3
    .map(([roman, ls]) => {
      const n = p3Items.find((it) => it[1] === roman)?.[0];
      return `<p class="para" id="t${n}"><span class="pn">${n ? `${n} · ` : ""}${roman}</span>${esc(join(ls))}</p>`;
    })
    .join("")}</article>`,
);

body.push(
  part(4, "Multiple choice · True / False / No Information", "21–29"),
  instr(p4Instr),
  `<article class="passage">${paras4.map((ls) => `<p>${esc(join(ls))}</p>`).join("")}</article>`,
  instr(p4BlockA),
  ...mcq4.map((q) => `<section class="task" id="t${q.n}"><p class="q"><b>${q.n}.</b> ${esc(q.q)}</p>${opts(q)}</section>`),
  instr(p4BlockB),
  `<p class="tfkey"><b>A</b> True <b>B</b> False <b>C</b> No Information</p>`,
  ...tf.map((q) => `<section class="task" id="t${q.n}"><p class="q"><b>${q.n}.</b> ${esc(q.q)}</p></section>`),
);

body.push(
  part(5, "Summary · Multiple choice", "30–35"),
  instr(p5Instr),
  `<article class="passage">${p5Title ? `<h3>${esc(p5Title)}</h3>` : ""}${p5Sub.length ? `<p class="sub">${esc(join(p5Sub))}</p>` : ""}${paras5.map((ls) => `<p>${esc(join(ls))}</p>`).join("")}</article>`,
  instr(sumInstr),
  `<div class="task summary">${sumTitle ? `<h3>${esc(sumTitle)}</h3>` : ""}<p>${sumText}</p></div>`,
  instr(mcq5Instr),
  ...mcq5.map((q) => `<section class="task" id="t${q.n}"><p class="q"><b>${q.n}.</b> ${esc(q.q)}</p>${opts(q)}</section>`),
);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;1,500&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
:root{--paper:#f3f0e8;--card:#fbfaf6;--ink:#141412;--muted:#66645c;--hair:#cdc8ba;--accent:#b8321a}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 "IBM Plex Sans",system-ui,sans-serif}
.book{max-width:820px;margin:0 auto;padding:28px 20px 60px}
header{border:1.5px solid var(--ink);background:var(--card);padding:18px 20px;margin-bottom:22px}
header h1{font:500 30px/1.1 Newsreader,serif;margin:4px 0 6px}
.eyebrow{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.rules{margin:10px 0 0;padding-left:18px;font-size:14px;color:var(--muted)}
.stage{font:500 22px Newsreader,serif;border-bottom:1.5px solid var(--ink);margin:38px 0 14px;padding-bottom:6px}
.stage small{font:500 11px "IBM Plex Mono",monospace;color:var(--accent);letter-spacing:.12em;margin-left:10px;text-transform:uppercase}
.instr{font-style:italic;color:var(--muted);border-left:3px solid var(--accent);padding:2px 0 2px 12px;margin:12px 0}
.type{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;margin:0 0 8px}
.passage{background:#fff;border:1px solid var(--hair);padding:20px 22px;margin:12px 0;font:17px/1.75 Newsreader,Georgia,serif}
.passage p{margin:0 0 12px}.passage p:last-child{margin:0}
.passage h3,.summary h3{font:500 21px Newsreader,serif;text-align:center;margin:0 0 10px}
.passage .sub{font-style:italic;text-align:center;color:var(--muted)}
.para .pn{display:inline-block;font:500 12px "IBM Plex Mono",monospace;background:var(--ink);color:var(--card);padding:1px 7px;margin-right:8px;vertical-align:2px}
.gap{display:inline-block;min-width:92px;border-bottom:1.5px solid var(--ink);text-align:left;margin:0 2px}
.gap b{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font:600 11px "IBM Plex Mono",monospace}
.task{background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--ink);padding:14px 16px;margin:10px 0}
.q{margin:0 0 8px}.q>b:first-child{font-family:"IBM Plex Mono",monospace;margin-right:6px}
.opts,.letters{list-style:none;padding:0;margin:0;display:grid;gap:6px}
.opts li,.letters li{display:flex;gap:10px;align-items:baseline}
.opts li b,.letters li b,.tfkey b{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border:1.5px solid var(--accent);border-radius:50%;color:var(--accent);font:600 11px "IBM Plex Mono",monospace}
.tfkey{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:14px;color:var(--muted)}.tfkey b{margin-right:-8px}
.ads{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}
.ad{position:relative;margin:0;background:#fff;border:1px solid var(--hair);padding:10px}
.ad img{display:block;width:100%;height:auto}
.ad figcaption{position:absolute;top:-10px;left:-10px;width:30px;height:30px;display:grid;place-items:center;background:var(--ink);color:var(--card);font:600 13px "IBM Plex Mono",monospace}
@media(max-width:600px){.ads{grid-template-columns:1fr}.passage{padding:16px;font-size:16px}}
</style></head>
<body><main class="book">
<header><div class="eyebrow">Milliy Mock · Multilevel (CEFR)</div><h1>${esc(title)}</h1>
<div class="eyebrow">Reading · 5 parts · 35 questions · 60 minutes</div>
<ul class="rules"><li>Write your answers on the answer sheet next to this booklet.</li><li>Questions 1–6 and 30–33: write ONE word only (spelling counts).</li><li>All other questions: choose a letter.</li></ul></header>
${body.join("\n")}
</main></body></html>`;

/* ---------------------------------------------------------------- key spec for publish-test.mjs */
const y1 = [];
for (let n = 7; n <= 29; n++) y1.push(`${n}${key[n]}`);
for (const n of [34, 35]) y1.push(`${n}${key[n]}`);
const o1 = {};
for (const n of [1, 2, 3, 4, 5, 6, 30, 31, 32, 33]) o1[n] = { accepted: [key[n].toLowerCase()] };
const spec = {
  title,
  description: "To‘liq Multilevel Reading mock: 5 qism, 35 savol, 60 daqiqa. Gap filling, e’lonlar, sarlavhalar, MCQ, True/False/No Information va summary.",
  subjectCode: "multilevel",
  mode: "practice",
  range: { from: 1, to: 35 },
  minutes: 60,
  timed: true,
  y1: y1.join(" "),
  topics: { 0: [1, 2, 3, 4, 5, 6], 1: [7, 8, 9, 10, 11, 12, 13, 14], 2: [15, 16, 17, 18, 19, 20], 3: [21, 22, 23, 24, 25, 26, 27, 28, 29], 4: [30, 31, 32, 33, 34, 35] },
  o1,
};
const outBase = path.join("content", name);
writeFileSync(`${outBase}.html`, html);
writeFileSync(`${outBase}.key.json`, JSON.stringify(spec, null, 2));
console.log(`✓ ${outBase}.html (${Math.round(html.length / 1024)} KB) + key — answer key checks passed`);
console.log("  " + Object.entries(key).map(([n, v]) => `${n}:${v}`).join("  "));
