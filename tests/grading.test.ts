import { describe, expect, it } from "vitest";
import { DEFAULT_FORMATS, deriveFormat, taskNumbers, validateFormat } from "@/lib/formats";
import { type AnswerKey, gradeAttempt, gradeO1, gradeY1, gradeY2, normalizeAnswer, parseNumeric, summarize, totalO2, validateRubric } from "@/lib/grading";
import { parseKeyPaste } from "@/lib/key-paste";
import { buildSheet, defaultStructure, validateKey } from "@/lib/sheet";

const bio = DEFAULT_FORMATS.find((f) => f.id === "biologiya-2025")!;
const chem = DEFAULT_FORMATS.find((f) => f.id === "kimyo-2025")!;
const math = DEFAULT_FORMATS.find((f) => f.id === "matematika-2024")!;
const phys = DEFAULT_FORMATS.find((f) => f.id === "fizika-2024")!;

describe("official format seeds", () => {
  it("biology & chemistry: 43 tasks, 100+80 = 180 minutes", () => {
    for (const f of [bio, chem]) {
      expect(f.totalTasks).toBe(43);
      expect(f.sections.map((s) => s.minutes)).toEqual([100, 80]);
      expect(f.totalMinutes).toBe(180);
      expect(validateFormat(f)).toEqual([]);
    }
  });
  it("O2 maxima: biology 30/35/10, chemistry 25/25/25", () => {
    expect(bio.o2Tasks.map((t) => t.maxScore)).toEqual([30, 35, 10]);
    expect(chem.o2Tasks.map((t) => t.maxScore)).toEqual([25, 25, 25]);
  });
  it("mathematics & physics: 45 tasks, 150 minutes, no O2", () => {
    for (const f of [math, phys]) {
      expect(f.totalTasks).toBe(45);
      expect(f.totalMinutes).toBe(150);
      expect(f.o2Tasks).toEqual([]);
      expect(f.taskGroups.some((g) => g.type === "O2")).toBe(false);
      expect(validateFormat(f)).toEqual([]);
    }
  });
  it("2026 platform formats: Biology/Chemistry 40 tasks in 100 min, no written part", () => {
    for (const id of ["biologiya-2026", "kimyo-2026"]) {
      const f = DEFAULT_FORMATS.find((x) => x.id === id)!;
      expect(f.totalTasks).toBe(40);
      expect(f.totalMinutes).toBe(100);
      expect(f.sections).toHaveLength(1);
      expect(f.o2Tasks).toEqual([]);
      expect(f.taskGroups.map((g) => `${g.type}:${g.from}-${g.to}`)).toEqual(["Y1:1-32", "Y2:33-35", "O1:36-40"]);
      expect(validateFormat(f)).toEqual([]);
    }
  });
  it("Multilevel: Reading 35 + Writing 3, per-task option counts", () => {
    const f = DEFAULT_FORMATS.find((x) => x.id === "multilevel-2026")!;
    expect(validateFormat(f)).toEqual([]);
    const sheet = buildSheet(f, defaultStructure(f));
    expect(sheet).toHaveLength(38);
    expect(sheet.find((s) => s.n === 10)?.options).toBe(8);
    expect(sheet.find((s) => s.n === 22)?.options).toBe(4);
    expect(sheet.find((s) => s.n === 27)?.options).toBe(3);
    expect(sheet.filter((s) => s.type === "O2").map((s) => s.section)).toEqual([1, 1, 1]);
  });
  it("no format claims a Rasch parameter set", () => {
    for (const f of DEFAULT_FORMATS) expect(f.raschParameterSetId).toBeNull();
  });
});

describe("normalization & numbers", () => {
  it("unifies subscripts, apostrophes, dashes and spaces", () => {
    expect(normalizeAnswer("  H₂O  ")).toBe("h2o");
    expect(normalizeAnswer("H₂O", true)).toBe("H2O");
    expect(normalizeAnswer("o‘simlik")).toBe(normalizeAnswer("o'simlik"));
    expect(normalizeAnswer("−5")).toBe("-5");
    expect(normalizeAnswer("a   b")).toBe("a b");
  });
  it("parses decimal comma, fractions and scientific notation", () => {
    expect(parseNumeric("0,5")).toBe(0.5);
    expect(parseNumeric("1/4")).toBe(0.25);
    expect(parseNumeric("1,5*10^3")).toBe(1500);
    expect(parseNumeric("2e-3")).toBeCloseTo(0.002);
    expect(parseNumeric("1/0")).toBeNull();
    expect(parseNumeric("abc")).toBeNull();
  });
});

describe("Y1", () => {
  it("grades exactly one correct letter", () => {
    expect(gradeY1("B", { type: "Y1", correct: "B" }).status).toBe("correct");
    expect(gradeY1("A", { type: "Y1", correct: "B" }).status).toBe("incorrect");
    expect(gradeY1(undefined, { type: "Y1", correct: "B" }).status).toBe("unanswered");
  });
});

describe("Y2", () => {
  const key = { type: "Y2" as const, left: 4, right: 6, pairs: ["A", "C", "E", "B"] };
  it("per-pair scoring stores each pair separately", () => {
    const r = gradeY2(["A", "C", "D", ""], key, "per_pair");
    expect(r.pairs).toEqual([true, true, false, false]);
    expect(r.score).toBe(2);
    expect(r.max).toBe(4);
    expect(r.status).toBe("partial");
  });
  it("all-or-nothing scoring", () => {
    expect(gradeY2(["A", "C", "E", "B"], key, "all_or_nothing")).toMatchObject({ score: 1, max: 1, status: "correct" });
    expect(gradeY2(["A", "C", "E", "A"], key, "all_or_nothing")).toMatchObject({ score: 0, status: "incorrect" });
  });
  it("empty answer is unanswered", () => {
    expect(gradeY2(["", "", "", ""], key, "per_pair").status).toBe("unanswered");
  });
});

describe("O1", () => {
  it("accepts numerically equal forms", () => {
    for (const a of ["0,5", "0.5", "1/2", ".5", "5e-1"]) expect(gradeO1(a, { type: "O1", accepted: ["0,5"] }).status).toBe("correct");
  });
  it("respects tolerance", () => {
    expect(gradeO1("3,15", { type: "O1", accepted: ["3,14"], tolerance: 0.01 }).status).toBe("correct");
    expect(gradeO1("3,2", { type: "O1", accepted: ["3,14"], tolerance: 0.01 }).status).toBe("incorrect");
  });
  it("routes unit mismatch and unparseable expressions to review, never guesses", () => {
    expect(gradeO1("5 m/s", { type: "O1", accepted: ["5"] }).status).toBe("needs_review");
    expect(gradeO1("5 m/s", { type: "O1", accepted: ["5"], unit: "m/s" }).status).toBe("correct");
    expect(gradeO1("6 m/s", { type: "O1", accepted: ["5"], unit: "m/s" }).status).toBe("incorrect");
    expect(gradeO1("sqrt(2)/2", { type: "O1", accepted: ["0,7071"] }).status).toBe("needs_review");
  });
  it("text answers: synonyms, case, typos", () => {
    const k = { type: "O1" as const, accepted: ["fotosintez", "fotosintez jarayoni"] };
    expect(gradeO1("Fotosintez", k).status).toBe("correct");
    expect(gradeO1("fotosintez  jarayoni", k).status).toBe("correct");
    expect(gradeO1("fotosintz", k).status).toBe("needs_review");
    expect(gradeO1("nafas olish", k).status).toBe("incorrect");
  });
  it("chemical formulas are case-sensitive when configured", () => {
    const k = { type: "O1" as const, accepted: ["CO"], caseSensitive: true };
    expect(gradeO1("CO", k).status).toBe("correct");
    expect(gradeO1("Co", k).status).toBe("needs_review");
    expect(gradeO1("H₂SO₄", { type: "O1", accepted: ["H2SO4"], caseSensitive: true }).status).toBe("correct");
  });
});

describe("whole attempt", () => {
  const structure = defaultStructure(bio);
  const sheet = buildSheet(bio, structure);
  const key: AnswerKey = {};
  for (const s of sheet) {
    if (s.type === "Y1") key[String(s.n)] = { type: "Y1", correct: "A", topic: bio.topics[s.n % 3] };
    if (s.type === "Y2") key[String(s.n)] = { type: "Y2", left: 4, right: 6, pairs: ["A", "B", "C", "D"] };
    if (s.type === "O1") key[String(s.n)] = { type: "O1", accepted: ["12"] };
  }
  it("produces a complete key according to validation", () => {
    expect(validateKey(bio, structure, key)).toEqual([]);
  });
  it("grades and never includes O2 in the raw result", () => {
    const res = gradeAttempt(bio, key, { "1": "A", "2": "B", "33": ["A", "B", "", ""], "36": "12,0" });
    expect(res.some((r) => r.type === "O2")).toBe(false);
    expect(res).toHaveLength(40);
    const s = summarize(res);
    expect(s.correct).toBe(2);
    expect(s.partial).toBe(1);
    expect(s.max).toBe(32 + 3 * 4 + 5);
    expect(s.score).toBe(1 + 2 + 1);
  });
  it("missing key items are sent to review, not guessed", () => {
    const res = gradeAttempt(bio, {}, { "1": "A" });
    expect(res.every((r) => r.status === "needs_review")).toBe(true);
  });
});

describe("O2 rubric", () => {
  it("validates criteria totals against the task maximum", () => {
    expect(validateRubric([{ id: "a", label: "Usul", component: "M", max: 20 }, { id: "b", label: "Hisob", component: "A", max: 10 }], 30)).toBeNull();
    expect(validateRubric([{ id: "a", label: "Usul", component: "M", max: 20 }], 30)).toMatch(/teng/);
    expect(validateRubric([{ id: "a", label: "Usul", component: "M", max: 30 }], 30)).toMatch(/A/);
  });
  it("totals M and A separately and caps at max", () => {
    expect(totalO2(bio, undefined, { n: 41, max: 30, m: 18, a: 7, criteria: [] })).toEqual({ m: 18, a: 7, total: 25 });
    expect(() => totalO2(bio, undefined, { n: 41, max: 30, m: 25, a: 10, criteria: [] })).toThrow();
    const k = { type: "O2" as const, criteria: [{ id: "m1", label: "Usul", component: "M" as const, max: 20 }, { id: "a1", label: "Hisob", component: "A" as const, max: 10 }] };
    expect(totalO2(bio, k, { n: 41, max: 30, m: 0, a: 0, criteria: [{ id: "m1", score: 15 }, { id: "a1", score: 4 }] })).toEqual({ m: 15, a: 4, total: 19 });
    expect(() => totalO2(bio, k, { n: 41, max: 30, m: 0, a: 0, criteria: [{ id: "m1", score: 21 }] })).toThrow();
  });
});

describe("practice formats", () => {
  it("keeps official numbering for a sub-range", () => {
    const d = deriveFormat(bio, 30, 37, 20, "practice");
    expect(taskNumbers(d)).toEqual([30, 31, 32, 33, 34, 35, 36, 37]);
    expect(d.sections).toHaveLength(1);
    expect(d.o2Tasks).toEqual([]);
    const sheet = buildSheet(d, defaultStructure(d));
    expect(sheet.map((s) => s.type)).toEqual(["Y1", "Y1", "Y1", "Y2", "Y2", "Y2", "O1", "O1"]);
  });
});

describe("key paste parser", () => {
  const sheet = buildSheet(bio, defaultStructure(bio));
  it("sequential letters", () => {
    const r = parseKeyPaste("ABCD", sheet, {});
    expect(r.applied).toEqual([1, 2, 3, 4]);
    expect(r.key["3"]).toMatchObject({ type: "Y1", correct: "C" });
  });
  it("numbered pairs, Y2 and O1 lines", () => {
    const r = parseKeyPaste("1A 2-b 3) C\n33: ACBD\n34: 1B 2A 3D 4C\n36: 0,25 | 1/4", sheet, {});
    expect(r.key["2"]).toMatchObject({ correct: "B" });
    expect(r.key["33"]).toMatchObject({ type: "Y2", pairs: ["A", "C", "B", "D"] });
    expect(r.key["34"]).toMatchObject({ pairs: ["B", "A", "D", "C"] });
    expect(r.key["36"]).toMatchObject({ type: "O1", accepted: ["0,25", "1/4"] });
    expect(r.skipped).toEqual([]);
  });
  it("rejects letters outside the option range", () => {
    const r = parseKeyPaste("5F", sheet, {});
    expect(r.applied).toEqual([]);
    expect(r.skipped).toEqual(["5F"]);
  });
});
