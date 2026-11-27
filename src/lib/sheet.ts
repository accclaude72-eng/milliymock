import { type ExamFormat, OPTION_LETTERS, o2MaxFor, range, sectionIndexOf, taskNumbers, taskTypeOf } from "./formats";
import { type AnswerKey, validateRubric } from "./grading";
import type { MaterialStructure, QuestionSheetItem } from "./types";

export const DEFAULT_Y2 = { left: 4, right: 6 };

/** Builds the answer-sheet layout from a format + per-material structure. */
export function buildSheet(format: ExamFormat, structure: MaterialStructure): QuestionSheetItem[] {
  return taskNumbers(format).map((n) => {
    const type = taskTypeOf(format, n)!;
    const item: QuestionSheetItem = { n, type, section: sectionIndexOf(format, n) };
    if (type === "Y1") item.options = structure.y1ByTask?.[String(n)] ?? (structure.y1Options || format.y1OptionCount);
    if (type === "Y2") {
      const y = structure.y2[String(n)] ?? DEFAULT_Y2;
      item.left = y.left;
      item.right = y.right;
    }
    if (type === "O2") item.o2Max = o2MaxFor(format, n);
    return item;
  });
}

export function defaultStructure(format: ExamFormat): MaterialStructure {
  const y2: MaterialStructure["y2"] = {};
  for (const g of format.taskGroups) if (g.type === "Y2") for (const n of range(g.from, g.to)) y2[String(n)] = { ...DEFAULT_Y2 };
  return { y1Options: format.y1OptionCount, y2, ...(format.y1OptionsByTask ? { y1ByTask: { ...format.y1OptionsByTask } } : {}) };
}

/** Checks an answer key against the format. Empty result = complete and consistent. */
export function validateKey(format: ExamFormat, structure: MaterialStructure, key: AnswerKey): string[] {
  const problems: string[] = [];
  for (const item of buildSheet(format, structure)) {
    const k = key[String(item.n)];
    const label = `${item.n}-topshiriq`;
    if (item.type === "Y1") {
      const allowed = OPTION_LETTERS.slice(0, item.options);
      if (!k || k.type !== "Y1" || !allowed.includes(k.correct)) problems.push(`${label} (Y1): to‘g‘ri javob tanlanmagan.`);
    } else if (item.type === "Y2") {
      if (!k || k.type !== "Y2") {
        problems.push(`${label} (Y2): moslashtirish kaliti kiritilmagan.`);
        continue;
      }
      if (k.left !== item.left || k.right !== item.right) problems.push(`${label} (Y2): kalit tuzilishi javoblar varaqasiga mos emas.`);
      const allowed = OPTION_LETTERS.slice(0, item.right);
      if (k.pairs.length !== item.left || k.pairs.some((p) => !allowed.includes(p)))
        problems.push(`${label} (Y2): barcha ${item.left} ta juftlik uchun javob tanlanishi kerak.`);
    } else if (item.type === "O1" || item.type === "O") {
      if (!k || (k.type !== "O1" && k.type !== "O") || k.accepted.filter((a) => a.trim()).length === 0)
        problems.push(`${label} (${item.type}): kamida bitta qabul qilinadigan javob kiriting.`);
      else if (k.tolerance != null && (!Number.isFinite(k.tolerance) || k.tolerance < 0)) problems.push(`${label}: tolerantlik manfiy bo‘lmasligi kerak.`);
    } else if (item.type === "O2") {
      if (k && k.type === "O2") {
        const err = validateRubric(k.criteria, item.o2Max ?? 0);
        if (err) problems.push(`${label} (O2): ${err}`);
      }
    }
  }
  return problems;
}
