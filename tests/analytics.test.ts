import { describe, expect, it } from "vitest";
import { type AttemptPoint, computeAnalytics } from "../src/lib/analytics";

const now = Date.parse("2026-12-10T08:00:00Z");
const D = 86_400_000;
const mk = (id: string, daysAgo: number, percent: number, subjectCode = "biologiya", topics: AttemptPoint["byTopic"] = {}): AttemptPoint => ({
  id,
  subjectCode,
  subjectName: subjectCode,
  title: id,
  at: now - daysAgo * D,
  percent,
  correct: Math.round(percent * 0.4),
  incorrect: 40 - Math.round(percent * 0.4),
  unanswered: 0,
  questions: 40,
  durationMs: 60 * 60_000,
  byTopic: topics,
});

describe("computeAnalytics", () => {
  it("returns empty, honest values without data", () => {
    const a = computeAnalytics([], [], now);
    expect(a.overview.exams).toBe(0);
    expect(a.overview.avgPercent).toBeNull();
    expect(a.overview.accuracy).toBeNull();
    expect(a.compare.lastMock).toBeNull();
    expect(a.last7).toHaveLength(7);
  });

  it("aggregates real attempts", () => {
    const a = computeAnalytics([mk("a", 3, 50), mk("b", 1, 75)], [], now);
    expect(a.overview.exams).toBe(2);
    expect(a.overview.avgPercent).toBe(62.5);
    expect(a.overview.bestPercent).toBe(75);
    expect(a.overview.studyMinutes).toBe(120);
    expect(a.overview.avgSecondsPerQuestion).toBe(90);
    expect(a.compare.lastMock?.delta).toBe(25);
  });

  it("finds weak topics with enough answers", () => {
    const a = computeAnalytics(
      [mk("a", 2, 50, "biologiya", { Genetika: { correct: 1, count: 5 }, Hujayra: { correct: 5, count: 5 } }), mk("b", 1, 50, "biologiya", { Genetika: { correct: 2, count: 5 } })],
      [],
      now,
    );
    expect(a.weakTopics.map((t) => t.topic)).toEqual(["Genetika"]);
    expect(a.weakTopics[0].accuracy).toBe(30);
  });

  it("compares this week with the previous one", () => {
    const a = computeAnalytics([mk("a", 10, 40), mk("b", 2, 80)], [], now);
    expect(a.compare.week.current.avgPercent).toBe(80);
    expect(a.compare.week.previous.avgPercent).toBe(40);
  });

  it("counts a streak of active days including practice", () => {
    const a = computeAnalytics([mk("a", 1, 50)], [{ at: now, correct: true }, { at: now - 2 * D, correct: false }], now);
    expect(a.overview.streak).toBe(3);
  });
});
