import { describe, expect, it } from "vitest";
import { DEFAULT_XP_RULES, challengeBonus, earnedAchievements, makeLayout, originalLetter, rng, shuffled } from "../src/lib/gamify";

describe("XP", () => {
  it("gives the bigger bonus only", () => {
    expect(challengeBonus(69.9, DEFAULT_XP_RULES)).toBe(0);
    expect(challengeBonus(70, DEFAULT_XP_RULES)).toBe(10);
    expect(challengeBonus(90, DEFAULT_XP_RULES)).toBe(20);
  });
});

describe("achievements", () => {
  const base = { challengesDone: 0, bestPercent: 0, streak: 0, challengeDays: [], today: "2026-12-15", totalXp: 0, mocks: {} };
  it("nothing without activity", () => expect(earnedAchievements(base)).toEqual([]));
  it("first challenge, perfect score, streaks", () => {
    const e = earnedAchievements({ ...base, challengesDone: 1, bestPercent: 100, streak: 7 });
    expect(e).toEqual(expect.arrayContaining(["first_challenge", "perfect_score", "streak_7"]));
    expect(e).not.toContain("streak_30");
  });
  it("subject mastery needs 3 mocks with avg ≥ 80", () => {
    expect(earnedAchievements({ ...base, mocks: { kimyo: { count: 3, avg: 81 } } })).toContain("master_kimyo");
    expect(earnedAchievements({ ...base, mocks: { kimyo: { count: 2, avg: 95 } } })).not.toContain("master_kimyo");
  });
  it("consistency counts distinct days in the last 14", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-12-${String(15 - i).padStart(2, "0")}`);
    expect(earnedAchievements({ ...base, challengeDays: days })).toContain("consistency");
    expect(earnedAchievements({ ...base, challengeDays: days.slice(0, 9) })).not.toContain("consistency");
  });
});

describe("seeded layout", () => {
  it("is deterministic per seed and differs between students", () => {
    const qs = Array.from({ length: 10 }, (_, i) => ({ id: `m:${i + 1}`, letters: ["A", "B", "C", "D"] }));
    const a1 = makeLayout(qs, "attempt-1");
    const a2 = makeLayout(qs, "attempt-1");
    const b = makeLayout(qs, "attempt-2");
    expect(a1).toEqual(a2);
    expect(JSON.stringify(a1)).not.toEqual(JSON.stringify(b));
    expect([...a1.order].sort()).toEqual(qs.map((q) => q.id).sort());
  });
  it("maps displayed letters back to the original options", () => {
    const l = makeLayout([{ id: "q", letters: ["A", "B", "C", "D"] }], "s");
    for (const [i, orig] of l.options.q.entries()) expect(originalLetter(l, "q", "ABCD"[i])).toBe(orig);
    expect(originalLetter(l, "q", "Z")).toBeNull();
  });
  it("shuffle keeps all items", () => {
    expect(shuffled([1, 2, 3, 4, 5], rng("x")).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
