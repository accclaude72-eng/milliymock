import { describe, expect, it } from "vitest";
import { BATTLE_XP, anonName, battleXp, decideWinner, optionOrder, randomCode } from "@/lib/battle";

const side = (userId: string, correct: number, answered: number, lastMs: number) => ({ userId, correct, answered, lastMs });

describe("decideWinner", () => {
  it("more correct answers wins", () => {
    expect(decideWinner(side("a", 5, 7, 90_000), side("b", 4, 7, 20_000))).toBe("a");
    expect(decideWinner(side("a", 2, 7, 1_000), side("b", 6, 7, 99_000))).toBe("b");
  });
  it("a tie is broken by speed when both answered the same number", () => {
    expect(decideWinner(side("a", 5, 7, 80_000), side("b", 5, 7, 60_000))).toBe("b");
  });
  it("otherwise a draw", () => {
    expect(decideWinner(side("a", 5, 7, 60_000), side("b", 5, 6, 60_000))).toBeNull();
    expect(decideWinner(side("a", 0, 7, 10_000), side("b", 0, 7, 20_000))).toBeNull();
    expect(decideWinner(side("a", 3, 7, 50_000), side("b", 3, 7, 50_000))).toBeNull();
  });
});

describe("battleXp", () => {
  it("rewards win, draw and play", () => {
    expect(battleXp(side("a", 5, 7, 1), "a", 7)).toBe(BATTLE_XP.win);
    expect(battleXp(side("a", 5, 7, 1), null, 7)).toBe(BATTLE_XP.draw);
    expect(battleXp(side("a", 2, 7, 1), "b", 7)).toBe(BATTLE_XP.play);
  });
  it("needs at least half of the questions answered", () => {
    expect(battleXp(side("a", 3, 3, 1), "a", 7)).toBe(0);
    expect(battleXp(side("a", 0, 4, 1), "b", 7)).toBe(BATTLE_XP.play);
  });
});

describe("optionOrder", () => {
  const letters = ["A", "B", "C", "D"];
  it("is a stable permutation per player and question", () => {
    const o = optionOrder("battle-1", "user-1", "q1", letters);
    expect([...o].sort()).toEqual(letters);
    expect(optionOrder("battle-1", "user-1", "q1", letters)).toEqual(o);
  });
  it("differs between players (for most questions)", () => {
    const diff = Array.from({ length: 20 }, (_, i) => JSON.stringify(optionOrder("b", "u1", `q${i}`, letters)) !== JSON.stringify(optionOrder("b", "u2", `q${i}`, letters)));
    expect(diff.filter(Boolean).length).toBeGreaterThan(10);
  });
});

describe("codes and names", () => {
  it("random codes use an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) expect(randomCode(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it("anonymous name never contains e-mail or the full id", () => {
    const n = anonName("f15d7589-9465-426a-93d6-539d7315ef79");
    expect(n).toBe("Nomzod F15D");
  });
});
