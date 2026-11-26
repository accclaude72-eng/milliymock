/**
 * Pure grading engine for Y1 / Y2 / O1 (O) tasks. No I/O — safe to unit test.
 * O2 written responses are never auto-graded here; they are scored by a human reviewer.
 */
import { type ExamFormat, type TaskType, range, isOpenShort, o2MaxFor } from "./formats";

/* --------------------------------------------------------------- key types */

export interface KeyY1 {
  type: "Y1";
  correct: string; // "A".."H"
  topic?: string;
}
export interface KeyY2 {
  type: "Y2";
  left: number; // number of items in the left column (sub-questions)
  right: number; // number of options in the right column
  pairs: string[]; // correct right-column letter for each left item
  topic?: string;
}
export interface KeyO1 {
  type: "O1" | "O";
  accepted: string[];
  /** Absolute numeric tolerance. Applies only when the accepted answer is numeric. */
  tolerance?: number | null;
  caseSensitive?: boolean;
  /** Expected unit (optional). When set, "5 m" is accepted for key "5" + unit "m". */
  unit?: string;
  topic?: string;
}
export type O2Component = "M" | "A";
export interface RubricCriterion {
  id: string;
  label: string;
  component: O2Component;
  max: number;
}
export interface KeyO2 {
  type: "O2";
  criteria: RubricCriterion[];
  topic?: string;
}
export type KeyItem = KeyY1 | KeyY2 | KeyO1 | KeyO2;
export type AnswerKey = Record<string, KeyItem>;

/* ------------------------------------------------------------ answer types */

export type AnswerValue = string | string[] | { text: string };
export type Answers = Record<string, AnswerValue>;

/* ----------------------------------------------------------- result types */

export type QStatus = "correct" | "incorrect" | "partial" | "unanswered" | "needs_review";

export interface QuestionResult {
  n: number;
  type: TaskType;
  status: QStatus;
  score: number;
  max: number;
  topic?: string;
  /** Y2: per-pair correctness. */
  pairs?: boolean[];
  /** O1: why it was routed to review. */
  reviewReason?: string;
  /** Set when a reviewer resolved a needs_review answer. */
  resolvedBy?: "reviewer";
}

export interface Bucket {
  score: number;
  max: number;
  correct: number;
  count: number;
}

export interface RawSummary {
  correct: number;
  incorrect: number;
  partial: number;
  unanswered: number;
  needsReview: number;
  score: number;
  max: number;
  percent: number;
  byType: Record<string, Bucket>;
  byTopic: Record<string, Bucket>;
}

/* ----------------------------------------------------------- normalization */

const APOSTROPHES = /[‘’‘’`´′ʹ]/g;
const DASHES = /[−‐‑‒–—﹣－]/g;
const MULTIPLY = /[×⋅·∙]/g;

/**
 * Normalizes a short answer for comparison:
 *  - NFKC (converts H₂O → H2O, x² → x2, full-width digits, ligatures)
 *  - unifies apostrophes (o‘ / o' / o‘ / o`), minus signs, multiplication dots, fraction slash
 *  - trims and collapses whitespace
 *  - lowercases unless caseSensitive
 */
export function normalizeAnswer(input: string, caseSensitive = false): string {
  let t = (input ?? "").normalize("NFKC");
  t = t.replace(APOSTROPHES, "'").replace(DASHES, "-").replace(MULTIPLY, "*").replace(/⁄/g, "/");
  t = t.replace(/\s+/g, " ").trim();
  if (!caseSensitive) t = t.toLowerCase();
  return t;
}

const NUM = String.raw`[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
const RE_PLAIN = new RegExp(`^${NUM}$`);
const RE_FRACTION = new RegExp(String.raw`^([+-]?\d+)\s*/\s*(\d+)$`);
const RE_SCI = new RegExp(String.raw`^(${NUM})\s*(?:\*|x)\s*10\s*\^\s*\(?([+-]?\d+)\)?$`, "i");
const RE_E = new RegExp(String.raw`^(${NUM})e([+-]?\d+)$`, "i");
const RE_WITH_UNIT = new RegExp(String.raw`^(${NUM}(?:\s*/\s*\d+)?)\s*([^\d\s.,+\-].*)$`);

function toNum(s: string): number {
  return Number(s.replace(",", "."));
}

/** Parses a strictly numeric answer (decimal comma or point, simple fraction, scientific). */
export function parseNumeric(normalized: string): number | null {
  const t = normalized.replace(/\s+/g, " ").trim();
  if (RE_PLAIN.test(t)) return toNum(t);
  let m = t.match(RE_FRACTION);
  if (m) {
    const d = Number(m[2]);
    return d === 0 ? null : Number(m[1]) / d;
  }
  m = t.match(RE_SCI);
  if (m) return toNum(m[1]) * Math.pow(10, Number(m[2]));
  m = t.match(RE_E);
  if (m) return toNum(m[1]) * Math.pow(10, Number(m[2]));
  return null;
}

function parseWithUnit(normalized: string): { value: number; unit: string } | null {
  const m = normalized.match(RE_WITH_UNIT);
  if (!m) return null;
  const value = parseNumeric(m[1]);
  if (value === null) return null;
  return { value, unit: m[2].trim() };
}

function nearlyEqual(a: number, b: number, tol: number): boolean {
  const eps = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tol + eps;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ------------------------------------------------------------- per type */

export function gradeY1(answer: AnswerValue | undefined, key: KeyY1): Pick<QuestionResult, "status" | "score" | "max"> {
  const a = typeof answer === "string" ? answer.trim().toUpperCase() : "";
  if (!a) return { status: "unanswered", score: 0, max: 1 };
  return a === key.correct.toUpperCase() ? { status: "correct", score: 1, max: 1 } : { status: "incorrect", score: 0, max: 1 };
}

export function gradeY2(
  answer: AnswerValue | undefined,
  key: KeyY2,
  scoring: "per_pair" | "all_or_nothing",
): Pick<QuestionResult, "status" | "score" | "max" | "pairs"> {
  const arr = Array.isArray(answer) ? answer : [];
  const given = range(0, key.left - 1).map((i) => (typeof arr[i] === "string" ? arr[i].trim().toUpperCase() : ""));
  const pairs = given.map((g, i) => g !== "" && g === (key.pairs[i] ?? "").toUpperCase());
  const correctCount = pairs.filter(Boolean).length;
  const anyAnswered = given.some((g) => g !== "");
  const max = scoring === "per_pair" ? key.left : 1;
  if (!anyAnswered) return { status: "unanswered", score: 0, max, pairs };
  const all = correctCount === key.left;
  const score = scoring === "per_pair" ? correctCount : all ? 1 : 0;
  const status: QStatus = all ? "correct" : correctCount > 0 && scoring === "per_pair" ? "partial" : "incorrect";
  return { status, score, max, pairs };
}

export function gradeO1(answer: AnswerValue | undefined, key: KeyO1): Pick<QuestionResult, "status" | "score" | "max" | "reviewReason"> {
  const raw = typeof answer === "string" ? answer : "";
  const cs = !!key.caseSensitive;
  const cand = normalizeAnswer(raw, cs);
  if (!cand) return { status: "unanswered", score: 0, max: 1 };
  const accepted = (key.accepted ?? []).map((a) => normalizeAnswer(a, cs)).filter(Boolean);
  if (accepted.length === 0) return { status: "needs_review", score: 0, max: 1, reviewReason: "Kalitda qabul qilinadigan javob yo‘q" };
  if (accepted.includes(cand)) return { status: "correct", score: 1, max: 1 };

  const tol = typeof key.tolerance === "number" && key.tolerance >= 0 ? key.tolerance : 0;
  const keyNums = accepted.map(parseNumeric).filter((x): x is number => x !== null);
  if (keyNums.length > 0) {
    const n = parseNumeric(cand);
    if (n !== null) {
      return keyNums.some((k) => nearlyEqual(n, k, tol)) ? { status: "correct", score: 1, max: 1 } : { status: "incorrect", score: 0, max: 1 };
    }
    const wu = parseWithUnit(cand);
    if (wu) {
      const valueOk = keyNums.some((k) => nearlyEqual(wu.value, k, tol));
      if (!valueOk) return { status: "incorrect", score: 0, max: 1 };
      if (key.unit && normalizeAnswer(key.unit, false) === normalizeAnswer(wu.unit, false)) return { status: "correct", score: 1, max: 1 };
      return { status: "needs_review", score: 0, max: 1, reviewReason: "Son to‘g‘ri, lekin o‘lchov birligi tekshirilishi kerak" };
    }
    if (/\d/.test(cand)) return { status: "needs_review", score: 0, max: 1, reviewReason: "Javob shakli avtomatik tekshirib bo‘lmaydigan ifoda" };
    return { status: "incorrect", score: 0, max: 1 };
  }

  const compact = (s: string) => s.replace(/\s+/g, "");
  if (accepted.some((a) => compact(a) === compact(cand))) {
    return { status: "needs_review", score: 0, max: 1, reviewReason: "Faqat bo‘shliqlar bilan farq qiladi" };
  }
  if (!cs && accepted.some((a) => a.length >= 5 && levenshtein(a, cand) <= 1)) {
    return { status: "needs_review", score: 0, max: 1, reviewReason: "Imlo xatosi bo‘lishi mumkin" };
  }
  if (cs) {
    const lower = cand.toLowerCase();
    if (accepted.some((a) => a.toLowerCase() === lower)) {
      return { status: "needs_review", score: 0, max: 1, reviewReason: "Faqat katta-kichik harf bilan farq qiladi" };
    }
  }
  return { status: "incorrect", score: 0, max: 1 };
}

/* ------------------------------------------------------------- whole test */

/** Grades all auto-gradable tasks. O2 tasks are excluded (handled by reviewers). */
export function gradeAttempt(format: ExamFormat, key: AnswerKey, answers: Answers): QuestionResult[] {
  const out: QuestionResult[] = [];
  for (const g of format.taskGroups) {
    if (g.type === "O2") continue;
    for (let n = g.from; n <= g.to; n++) {
      const k = key[String(n)];
      const a = answers[String(n)];
      const typeOk = !!k && (isOpenShort(g.type) ? isOpenShort(k.type) : k.type === g.type);
      if (!k || !typeOk) {
        // Missing / mismatched key — never guess. Route to review.
        out.push({ n, type: g.type, status: "needs_review", score: 0, max: 1, reviewReason: "Javoblar kalitida ushbu topshiriq yo‘q" });
        continue;
      }
      if (k.type === "Y1") out.push({ n, type: "Y1", topic: k.topic, ...gradeY1(a, k) });
      else if (k.type === "Y2") out.push({ n, type: "Y2", topic: k.topic, ...gradeY2(a, k, format.y2Scoring) });
      else if (k.type === "O1" || k.type === "O") out.push({ n, type: g.type, topic: k.topic, ...gradeO1(a, k) });
    }
  }
  return out;
}

/** Re-derives the raw summary from question results (also used after a reviewer resolves needs_review items). */
export function summarize(results: QuestionResult[]): RawSummary {
  const s: RawSummary = {
    correct: 0,
    incorrect: 0,
    partial: 0,
    unanswered: 0,
    needsReview: 0,
    score: 0,
    max: 0,
    percent: 0,
    byType: {},
    byTopic: {},
  };
  const bump = (rec: Record<string, Bucket>, k: string, r: QuestionResult) => {
    const b = (rec[k] ??= { score: 0, max: 0, correct: 0, count: 0 });
    b.score += r.score;
    b.max += r.max;
    b.count += 1;
    if (r.status === "correct") b.correct += 1;
  };
  for (const r of results) {
    if (r.status === "correct") s.correct++;
    else if (r.status === "incorrect") s.incorrect++;
    else if (r.status === "partial") s.partial++;
    else if (r.status === "unanswered") s.unanswered++;
    else if (r.status === "needs_review") s.needsReview++;
    s.score += r.score;
    s.max += r.max;
    bump(s.byType, r.type, r);
    if (r.topic) bump(s.byTopic, r.topic, r);
  }
  s.percent = s.max > 0 ? Math.round((s.score / s.max) * 1000) / 10 : 0;
  return s;
}

/* -------------------------------------------------------------- O2 review */

export interface O2CriterionScore {
  id: string;
  score: number;
  comment?: string;
}
export interface O2TaskReview {
  n: number;
  max: number;
  /** When no rubric criteria are configured, reviewer gives M and A directly. */
  m: number;
  a: number;
  criteria: O2CriterionScore[];
  comment?: string;
  errorTags?: string[];
}

/**
 * Validates and totals an O2 review for one task. Throws a readable error on invalid input.
 */
export function totalO2(format: ExamFormat, key: KeyO2 | undefined, review: O2TaskReview): { m: number; a: number; total: number } {
  const max = o2MaxFor(format, review.n);
  if (max <= 0) throw new Error(`${review.n}-topshiriq yozma ish emas.`);
  const criteria = key?.criteria ?? [];
  let m = 0;
  let a = 0;
  if (criteria.length > 0) {
    for (const c of criteria) {
      const sc = review.criteria.find((x) => x.id === c.id)?.score ?? 0;
      if (!Number.isFinite(sc) || sc < 0 || sc > c.max) throw new Error(`"${c.label}" mezoni uchun ball 0–${c.max} oralig‘ida bo‘lishi kerak.`);
      if (c.component === "M") m += sc;
      else a += sc;
    }
  } else {
    m = review.m;
    a = review.a;
    if (!Number.isFinite(m) || !Number.isFinite(a) || m < 0 || a < 0) throw new Error("M va A ballari manfiy bo‘lmasligi kerak.");
  }
  const total = Math.round((m + a) * 100) / 100;
  if (total > max) throw new Error(`${review.n}-topshiriq uchun jami ball ${max} dan oshmasligi kerak.`);
  return { m, a, total };
}

/** Checks an O2 rubric against the task maximum from the format. */
export function validateRubric(criteria: RubricCriterion[], max: number): string | null {
  if (criteria.length === 0) return null;
  for (const c of criteria) {
    if (!c.label.trim()) return "Mezon nomi bo‘sh bo‘lmasligi kerak.";
    if (!(c.max > 0)) return `"${c.label}" mezoni maksimal balli musbat bo‘lishi kerak.`;
  }
  const sum = criteria.reduce((s, c) => s + c.max, 0);
  if (Math.abs(sum - max) > 1e-9) return `Mezonlar yig‘indisi (${sum}) topshiriq maksimal balliga (${max}) teng bo‘lishi kerak.`;
  if (!criteria.some((c) => c.component === "M") || !criteria.some((c) => c.component === "A"))
    return "Rubrikada kamida bitta M (yechim usuli) va bitta A (hisob-kitob) mezoni bo‘lishi kerak.";
  return null;
}
