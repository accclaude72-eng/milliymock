import { OPTION_LETTERS } from "./formats";
import type { AnswerKey, KeyItem } from "./grading";
import type { QuestionSheetItem } from "./types";

/**
 * Parses a pasted answer key. Supported:
 *   "ABCDABCD…"                      → sequential Y1 answers
 *   "1A 2B 3-C 4) D, 5.A"           → Y1 pairs (any separators)
 *   "33: ACBD" or "33: 1A 2C 3B 4D"  → Y2 task
 *   "36: 0,25 | 1/4"                 → O1 accepted answers (| separates alternatives)
 */
export function parseKeyPaste(text: string, sheet: QuestionSheetItem[], current: AnswerKey): { key: AnswerKey; applied: number[]; skipped: string[] } {
  const key: AnswerKey = { ...current };
  const applied: number[] = [];
  const skipped: string[] = [];
  const byN = new Map(sheet.map((s) => [s.n, s]));
  const y1 = sheet.filter((s) => s.type === "Y1");

  const setY1 = (n: number, letter: string) => {
    const s = byN.get(n);
    const L = letter.toUpperCase();
    if (!s || s.type !== "Y1" || !OPTION_LETTERS.slice(0, s.options).includes(L)) {
      skipped.push(`${n}${letter}`);
      return;
    }
    key[String(n)] = { ...(key[String(n)] as KeyItem | undefined), type: "Y1", correct: L } as KeyItem;
    applied.push(n);
  };

  const compact = text.replace(/\s+/g, "");
  if (/^[A-Ha-h]{2,}$/.test(compact)) {
    compact.split("").forEach((l, i) => (y1[i] ? setY1(y1[i].n, l) : skipped.push(l)));
    return { key, applied, skipped };
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,3})\s*[:)\].\-–]\s*(.+)$/);
    const s = m ? byN.get(Number(m[1])) : undefined;
    if (m && s && (s.type === "O1" || s.type === "O")) {
      const accepted = m[2]
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean);
      const prev = key[String(s.n)];
      key[String(s.n)] = { ...(prev && (prev.type === "O1" || prev.type === "O") ? prev : {}), type: s.type, accepted } as KeyItem;
      applied.push(s.n);
      continue;
    }
    if (m && s && s.type === "Y2") {
      const body = m[2].toUpperCase();
      const pairs = Array.from({ length: s.left ?? 0 }, () => "");
      const explicit = Array.from(body.matchAll(/(\d{1,2})\s*[-–.)]?\s*([A-H])/g));
      if (explicit.length) explicit.forEach((x) => (Number(x[1]) >= 1 && Number(x[1]) <= pairs.length ? (pairs[Number(x[1]) - 1] = x[2]) : undefined));
      else body.replace(/[^A-H]/g, "").split("").slice(0, pairs.length).forEach((l, i) => (pairs[i] = l));
      const allowed = OPTION_LETTERS.slice(0, s.right);
      if (pairs.some((p) => p && !allowed.includes(p))) {
        skipped.push(line);
        continue;
      }
      const prev = key[String(s.n)];
      key[String(s.n)] = { ...(prev && prev.type === "Y2" ? prev : {}), type: "Y2", left: s.left ?? 0, right: s.right ?? 0, pairs } as KeyItem;
      applied.push(s.n);
      continue;
    }
    const pairs = Array.from(line.matchAll(/(\d{1,3})\s*[-–.):]?\s*([A-Ha-h])(?![A-Za-z])/g));
    if (pairs.length) pairs.forEach((p) => setY1(Number(p[1]), p[2]));
    else skipped.push(line);
  }
  return { key, applied, skipped };
}
