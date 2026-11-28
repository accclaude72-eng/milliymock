import { describe, expect, it } from "vitest";
import { afterCorrect, afterWrong } from "../src/lib/srs";
import { generatePlan, streak, studyDates, weightOf } from "../src/lib/study-plan";

const base = {
  today: "2026-12-01", // Tuesday
  examDate: "2026-12-29",
  studyDays: [1, 2, 3, 4, 5, 6],
  dailyMinutes: 60,
  topics: [
    { name: "Genetika", accuracy: 40 },
    { name: "Hujayra", accuracy: 90 },
    { name: "Ekologiya", accuracy: null },
  ],
  priority: [],
  dueMistakes: 12,
};

describe("study plan", () => {
  it("uses only selected weekdays and stops before the exam day", () => {
    const d = studyDates(base);
    expect(d[0]).toBe("2026-12-01");
    expect(d.every((x) => new Date(`${x}T00:00:00Z`).getUTCDay() !== 0)).toBe(true);
    expect(d.includes("2026-12-29")).toBe(false);
    expect(d.at(-1)).toBe("2026-12-28");
  });

  it("gives weak topics more practice days than strong ones", () => {
    const tasks = generatePlan(base).filter((t) => t.kind === "practice");
    const count = (n: string) => tasks.filter((t) => t.topic === n).length;
    expect(count("Genetika")).toBeGreaterThan(count("Hujayra"));
    expect(count("Hujayra")).toBeGreaterThan(0);
  });

  it("adds weekly assessments, mocks before the exam and mistake reviews", () => {
    const tasks = generatePlan(base);
    expect(tasks.some((t) => t.kind === "assessment")).toBe(true);
    expect(tasks.filter((t) => t.kind === "mock").map((t) => t.day)).toContain("2026-12-28");
    expect(tasks.some((t) => t.kind === "mistakes")).toBe(true);
  });

  it("never exceeds the daily time budget", () => {
    const byDay = new Map<string, number>();
    for (const t of generatePlan(base)) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.minutes);
    for (const m of byDay.values()) expect(m).toBeLessThanOrEqual(65);
  });

  it("priority boosts a topic", () => {
    expect(weightOf({ name: "Hujayra", accuracy: 90 }, ["Hujayra"])).toBeGreaterThan(weightOf({ name: "Hujayra", accuracy: 90 }, []));
  });

  it("returns nothing when the exam has passed", () => {
    expect(generatePlan({ ...base, examDate: "2026-11-30" })).toEqual([]);
  });

  it("counts a study streak ending today or yesterday", () => {
    expect(streak(["2026-12-01", "2026-12-02", "2026-12-03"], "2026-12-03")).toBe(3);
    expect(streak(["2026-12-01", "2026-12-02"], "2026-12-03")).toBe(2);
    expect(streak(["2026-12-01"], "2026-12-03")).toBe(0);
  });
});

describe("mistake spaced repetition", () => {
  const now = Date.parse("2026-12-01T10:00:00Z");
  it("schedules 1 → 3 → 7 days and resolves after three correct answers", () => {
    let s = afterWrong(null, now);
    expect(s.wrong_count).toBe(1);
    expect(Date.parse(s.next_review_at) - now).toBe(86_400_000);
    s = afterCorrect(s, now);
    expect(s.review_stage).toBe(1);
    expect(Date.parse(s.next_review_at) - now).toBe(3 * 86_400_000);
    s = afterCorrect(s, now);
    expect(Date.parse(s.next_review_at) - now).toBe(7 * 86_400_000);
    s = afterCorrect(s, now);
    expect(s.status).toBe("resolved");
  });
  it("a wrong answer resets the schedule", () => {
    const s = afterWrong(afterCorrect(afterWrong(null, now), now), now);
    expect(s.review_stage).toBe(0);
    expect(s.correct_streak).toBe(0);
    expect(s.wrong_count).toBe(2);
  });
});
