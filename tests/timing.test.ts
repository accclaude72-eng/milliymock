import { describe, expect, it } from "vitest";
import { advance, currentDeadline, finishAll, initTiming, reconcile, timeSpentMs } from "@/lib/timing";

const MIN = 60_000;

describe("server timing state machine", () => {
  const t0 = 1_000_000;
  const base = initTiming([100 * MIN, 80 * MIN], t0);

  it("does not change before the deadline", () => {
    const r = reconcile(base, t0 + 99 * MIN);
    expect(r.changed).toBe(false);
    expect(currentDeadline(r.state)).toBe(t0 + 100 * MIN);
  });

  it("closes stage 1 exactly at its deadline and starts stage 2 at that instant", () => {
    const r = reconcile(base, t0 + 130 * MIN);
    expect(r.state.index).toBe(1);
    expect(r.state.ends[0]).toBe(t0 + 100 * MIN);
    expect(r.state.starts[1]).toBe(t0 + 100 * MIN);
    expect(currentDeadline(r.state)).toBe(t0 + 180 * MIN);
  });

  it("finishes the whole attempt after both stages, never runs negative", () => {
    const r = reconcile(base, t0 + 999 * MIN);
    expect(r.state.finished).toBe(true);
    expect(r.state.finishedAt).toBe(t0 + 180 * MIN);
    expect(currentDeadline(r.state)).toBeNull();
    expect(timeSpentMs(r.state, t0 + 999 * MIN)).toBe(180 * MIN);
  });

  it("early advance gives stage 2 its full 80 minutes", () => {
    const r = advance(base, t0 + 60 * MIN, 0);
    expect(r.state.index).toBe(1);
    expect(currentDeadline(r.state)).toBe(t0 + 140 * MIN);
  });

  it("advance is idempotent (double click / retry)", () => {
    const once = advance(base, t0 + 60 * MIN, 0).state;
    const twice = advance(once, t0 + 61 * MIN, 0);
    expect(twice.changed).toBe(false);
    expect(twice.state.starts[1]).toBe(t0 + 60 * MIN);
  });

  it("final submission is idempotent", () => {
    const a = finishAll(base, t0 + 10 * MIN).state;
    const b = finishAll(a, t0 + 20 * MIN);
    expect(b.changed).toBe(false);
    expect(b.state.finishedAt).toBe(t0 + 10 * MIN);
  });

  it("untimed practice never expires", () => {
    const p = initTiming([null], t0);
    expect(reconcile(p, t0 + 10_000 * MIN).state.finished).toBe(false);
    expect(currentDeadline(p)).toBeNull();
  });
});
