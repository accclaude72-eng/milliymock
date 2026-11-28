import { describe, expect, it } from "vitest";
import { NEW_CARD, addDays, embedUrl, parseCardLines, parseVideoUrl, previewIntervals, review } from "@/lib/sm2";

describe("SM-2", () => {
  it("first reviews: 1 day, then 6 days, then interval × ease", () => {
    const a = review(NEW_CARD, 4);
    expect(a.interval_days).toBe(1);
    const b = review(a, 4);
    expect(b.interval_days).toBe(6);
    const c = review(b, 4);
    expect(c.interval_days).toBe(Math.round(6 * b.ease));
  });
  it("a failed card starts over and counts a lapse", () => {
    const b = review(review(NEW_CARD, 5), 5);
    const f = review(b, 1);
    expect(f).toMatchObject({ interval_days: 1, repetitions: 0, lapses: 1 });
    expect(f.ease).toBeLessThan(b.ease);
  });
  it("ease never drops below 1.3", () => {
    let s = NEW_CARD;
    for (let i = 0; i < 20; i++) s = review(s, 0);
    expect(s.ease).toBe(1.3);
  });
  it("easy raises ease, hard lowers it", () => {
    expect(review(NEW_CARD, 5).ease).toBeGreaterThan(2.5);
    expect(review(NEW_CARD, 3).ease).toBeLessThan(2.5);
  });
  it("intervals preview grows with grade", () => {
    const p = previewIntervals(review(review(NEW_CARD, 4), 4));
    expect(p[1]).toBe(1);
    expect(p[5]).toBeGreaterThanOrEqual(p[4]);
    expect(p[4]).toBeGreaterThanOrEqual(p[3]);
  });
  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("parsers", () => {
  it("bulk card lines", () => {
    expect(parseCardLines("Mitoz | bo‘linish\n\nyo‘q ajratgich\n A | B | C ")).toEqual([
      { front: "Mitoz", back: "bo‘linish" },
      { front: "A", back: "B | C" },
    ]);
  });
  it("YouTube and Vimeo links", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")).toEqual({ provider: "youtube", ref: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ provider: "youtube", ref: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", ref: "123456789" });
    expect(parseVideoUrl("https://example.com/x")).toBeNull();
    expect(embedUrl("youtube", "dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
