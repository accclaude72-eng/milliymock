import { describe, expect, it } from "vitest";
import { greeting, levelFromXp, levelTitle } from "@/lib/level";

describe("levels", () => {
  it("starts at level 1", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100, progress: 0 });
    expect(levelFromXp(-5).level).toBe(1);
  });
  it("each level needs 100 more XP", () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, into: 0, need: 200 });
    expect(levelFromXp(299)).toMatchObject({ level: 2, into: 199 });
    expect(levelFromXp(300)).toMatchObject({ level: 3, into: 0, need: 300 });
    expect(levelFromXp(450).progress).toBeCloseTo(0.5);
  });
  it("titles cap at the last one", () => {
    expect(levelTitle(1)).toBe("Boshlovchi");
    expect(levelTitle(99)).toBe("Afsona");
  });
  it("greets by time of day", () => {
    expect(greeting(7).part).toBe("tong");
    expect(greeting(13).part).toBe("kun");
    expect(greeting(20).part).toBe("kech");
    expect(greeting(2).part).toBe("tun");
  });
});
