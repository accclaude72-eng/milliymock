// Builds the Multilevel (CEFR) Writing part — Task 1.1, Task 1.2 and Task 2 (questions 36–38) —
// and, from an existing Reading booklet, a full Reading + Writing mock.
//
//   node scripts/build-multilevel-writing.mjs content/multilevel-reading-1 [n]
//   → content/multilevel-writing-<n>.html + .key.json   (Writing only, 60 min)
//   → content/multilevel-full-<n>.html + .key.json      (Reading + Writing, 120 min)
//   Publish each with scripts/publish-test.mjs.
//
// Writing is never auto-graded: the key only carries the examiner rubric (M = content and
// organisation, A = language accuracy); the sums match the format maxima 10 / 15 / 25.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [readingDir, nArg] = process.argv.slice(2);
if (!readingDir) {
  console.error("Usage: node scripts/build-multilevel-writing.mjs content/<reading-name> [n]");
  process.exit(1);
}
const n = nArg ?? "1";
const readingHtml = readFileSync(`${readingDir}.html`, "utf8");
const readingKey = JSON.parse(readFileSync(`${readingDir}.key.json`, "utf8"));

/* ---------------------------------------------------------------- content */
const W = {
  situation: {
    title: "Changes at the Riverside Sports Centre",
    intro: "You are a member of the Riverside Sports Centre. Yesterday all members received this message from the centre manager:",
    notice: [
      "Dear Members,",
      "We would like to inform you about some changes that will start next month. Because of rising energy costs, the centre will close at 7 p.m. instead of 10 p.m. on weekdays. The swimming pool will also be closed at weekends for three months while we repair the roof. Finally, the monthly membership fee will increase by 20%.",
      "We understand that these changes may be inconvenient, and we welcome your comments and suggestions.",
      "Mr. David Collins, Centre Manager",
    ],
  },
  t11: {
    n: 36,
    title: "Task 1.1",
    words: "about 50 words",
    prompt:
      "Write a letter to your friend, who is also a member of the centre. Tell your friend about the message, how you feel about the changes and what you are planning to do.",
  },
  t12: {
    n: 37,
    title: "Task 1.2",
    words: "120–150 words",
    prompt:
      "Write a letter to the centre manager. Say which change affects you most and why, explain how it will change your routine, and suggest what the centre could do to solve the problem.",
  },
  t2: {
    n: 38,
    title: "Task 2",
    words: "180–200 words",
    intro: "You are taking part in an online discussion on an education website. Read the question and write your response.",
    question:
      "Some people believe that schools should teach practical life skills, such as cooking, managing money and first aid. Others think that schools should focus only on academic subjects like mathematics, science and languages.",
    ask: "Discuss both views and give your own opinion. Support your answer with reasons and relevant examples from your own knowledge or experience.",
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const box = (t) =>
  `<section class="task wtask" id="t${t.n}"><div class="wt-head"><span class="wt-n">${t.n}</span><b>${t.title}</b><span class="wt-w">${t.words}</span></div><p>${esc(t.prompt)}</p>
<p class="wt-note">Write your answer in the answer sheet (task ${t.n}). Its word counter shows how many words you have written.</p></section>`;

const WRITING_CSS = `
.notice{background:#fff;border:1.5px solid var(--ink);padding:18px 22px;margin:12px 0;font:17px/1.7 Newsreader,Georgia,serif;position:relative}
.notice::before{content:"MESSAGE";position:absolute;top:-10px;left:14px;background:var(--accent);color:#fff;font:600 10px "IBM Plex Mono",monospace;letter-spacing:.14em;padding:2px 8px}
.notice p{margin:0 0 10px}.notice p:last-child{margin:0;font-style:italic;text-align:right}
.wtask p{margin:6px 0 0}
.wt-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wt-n{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;font:600 12px "IBM Plex Mono",monospace}
.wt-w{margin-left:auto;font:500 11px "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);padding:1px 8px}
.wt-note{font-size:13px;color:var(--muted);font-style:italic}
.question{background:#fff;border-left:4px solid var(--accent);padding:14px 18px;margin:12px 0;font:17px/1.7 Newsreader,Georgia,serif}
.tips{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:14px 0;padding:0;list-style:none}
.tips li{background:var(--card);border:1px dashed var(--hair);padding:10px 12px;font-size:14px}
.tips b{display:block;font:500 11px "IBM Plex Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}`;

const writingBody = `
<h2 class="stage">Writing · Part 1<small>Tasks 1.1 – 1.2 · 36–37</small></h2>
<p class="instr">${esc(W.situation.intro)}</p>
<div class="notice"><p><b>${esc(W.situation.title)}</b></p>${W.situation.notice.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
${box(W.t11)}
${box(W.t12)}
<h2 class="stage">Writing · Part 2<small>Task 2 · 38</small></h2>
<p class="instr">${esc(W.t2.intro)}</p>
<div class="question"><p>${esc(W.t2.question)}</p><p><b>${esc(W.t2.ask)}</b></p></div>
${box({ ...W.t2, prompt: "Write an essay giving your opinion. Use an introduction, two or three body paragraphs and a conclusion." })}
<ul class="tips">
<li><b>Task 1.1</b>Informal style: greeting, contractions, friendly tone — about 50 words.</li>
<li><b>Task 1.2</b>Formal style: clear purpose, polite complaint, concrete suggestions — 120–150 words.</li>
<li><b>Task 2</b>Both views + your opinion, linking words, examples — 180–200 words.</li>
</ul>`;

const style = /<style>([\s\S]*?)<\/style>/.exec(readingHtml)?.[1];
if (!style) throw new Error("reading booklet has no <style>");
const head = (title) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;1,500&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>${style}${WRITING_CSS}</style></head>`;

const RUBRIC = {
  36: [
    { id: "task", label: "Task achievement & organisation (purpose, all points, informal tone)", component: "M", max: 5 },
    { id: "lang", label: "Language: vocabulary and grammar accuracy", component: "A", max: 5 },
  ],
  37: [
    { id: "task", label: "Task achievement (all points covered, clear purpose)", component: "M", max: 5 },
    { id: "coh", label: "Coherence, organisation & formal register", component: "M", max: 4 },
    { id: "lex", label: "Vocabulary range and accuracy", component: "A", max: 3 },
    { id: "gram", label: "Grammar range and accuracy", component: "A", max: 3 },
  ],
  38: [
    { id: "task", label: "Task response (both views, clear opinion, examples)", component: "M", max: 7 },
    { id: "coh", label: "Coherence & cohesion (paragraphs, linking)", component: "M", max: 6 },
    { id: "lex", label: "Lexical resource", component: "A", max: 6 },
    { id: "gram", label: "Grammatical range & accuracy", component: "A", max: 6 },
  ],
};

/* ---------------------------------------------------------------- Writing only */
const wTitle = `Multilevel Writing — Mock ${n}`;
const writingHtml = `${head(wTitle)}
<body><main class="book">
<header><div class="eyebrow">Milliy Mock · Multilevel (CEFR)</div><h1>${esc(wTitle)}</h1>
<div class="eyebrow">Writing · 2 parts · 3 tasks · 60 minutes</div>
<ul class="rules"><li>Read the message and the question in this booklet, then type your answers in the answer sheet (tasks 36–38).</li><li>Suggested time: Task 1.1 — 10 min, Task 1.2 — 20 min, Task 2 — 30 min.</li><li>An examiner marks your writing for content and organisation (M) and language accuracy (A).</li></ul></header>
${writingBody}
</main>
<script>window.parent!==window&&window.parent.postMessage({mm:"ready"},"*");</script></body></html>`;
const writingKey = {
  title: wTitle,
  description: "Multilevel Writing mock: Task 1.1 (norasmiy xat, ~50 so‘z), Task 1.2 (rasmiy xat, 120–150 so‘z) va Task 2 (esse, 180–200 so‘z), 60 daqiqa. Ekspert mezonlar bo‘yicha baholaydi.",
  subjectCode: "multilevel",
  mode: "practice",
  range: { from: 36, to: 38 },
  minutes: 60,
  timed: true,
  y1: "",
  topics: { 5: [36, 37], 6: [38] },
  o2: RUBRIC,
};

/* ---------------------------------------------------------------- Reading + Writing */
const fTitle = `Multilevel Full Mock ${n} — Reading + Writing`;
const fullHtml = readingHtml
  .replace(/<style>[\s\S]*?<\/style>/, `<style>${style}${WRITING_CSS}</style>`)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fTitle)}</title>`)
  .replace(/(<header>[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/, `$1${esc(fTitle)}$2`)
  .replace("Reading · 5 parts · 35 questions · 60 minutes", "Reading (1–35, 60 min) · Writing (36–38, 60 min)")
  .replace("</main>", `${writingBody}\n</main>`);
if (!fullHtml.includes('id="t38"')) throw new Error("writing not inserted");
const fullKey = {
  ...readingKey,
  title: fTitle,
  description: "To‘liq Multilevel mock: Reading (35 savol, 60 daqiqa, avtomatik tekshiriladi) va Writing (3 topshiriq, 60 daqiqa, ekspert baholaydi).",
  mode: "full",
  range: null,
  minutes: null,
  topics: { ...readingKey.topics, 5: [36, 37], 6: [38] },
  o2: RUBRIC,
};

const out = path.dirname(readingDir);
for (const [name, html, key] of [
  [`multilevel-writing-${n}`, writingHtml, writingKey],
  [`multilevel-full-${n}`, fullHtml, fullKey],
]) {
  writeFileSync(path.join(out, `${name}.html`), html);
  writeFileSync(path.join(out, `${name}.key.json`), JSON.stringify(key, null, 2));
  console.log(`✓ ${name}.html (${(html.length / 1024).toFixed(0)} KB) + key`);
}
