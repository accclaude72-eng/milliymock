/**
 * Server-authoritative section timing. Pure functions over plain data.
 *
 * Sections run strictly one after another. When a timed section's deadline passes,
 * it is closed AT the deadline and the next section starts at that same instant —
 * exactly like a proctored paper exam where stage 2 begins when stage 1 time is up.
 * When the last section closes, the attempt is finished.
 */

export interface TimingState {
  /** Duration of each section in ms, or null for untimed (practice) sections. */
  durationsMs: (number | null)[];
  starts: (number | null)[];
  ends: (number | null)[];
  index: number;
  finished: boolean;
  finishedAt: number | null;
}

export function initTiming(durationsMs: (number | null)[], now: number): TimingState {
  return {
    durationsMs: [...durationsMs],
    starts: durationsMs.map((_, i) => (i === 0 ? now : null)),
    ends: durationsMs.map(() => null),
    index: 0,
    finished: false,
    finishedAt: null,
  };
}

function clone(s: TimingState): TimingState {
  return { ...s, durationsMs: [...s.durationsMs], starts: [...s.starts], ends: [...s.ends] };
}

/** Applies all deadline expirations up to `now`. */
export function reconcile(state: TimingState, now: number): { state: TimingState; changed: boolean } {
  const s = clone(state);
  let changed = false;
  while (!s.finished) {
    const i = s.index;
    const d = s.durationsMs[i];
    const start = s.starts[i];
    if (d == null || start == null) break;
    const deadline = start + d;
    if (now < deadline) break;
    s.ends[i] = deadline;
    changed = true;
    if (i + 1 < s.durationsMs.length) {
      s.starts[i + 1] = deadline;
      s.index = i + 1;
    } else {
      s.finished = true;
      s.finishedAt = deadline;
    }
  }
  return { state: s, changed };
}

/** Candidate finishes the current section early. Idempotent: no-op unless `fromIndex` is current. */
export function advance(state: TimingState, now: number, fromIndex: number): { state: TimingState; changed: boolean } {
  const r = reconcile(state, now);
  const s = r.state;
  if (s.finished || s.index !== fromIndex) return r;
  s.ends[fromIndex] = now;
  if (fromIndex + 1 < s.durationsMs.length) {
    s.starts[fromIndex + 1] = now;
    s.index = fromIndex + 1;
  } else {
    s.finished = true;
    s.finishedAt = now;
  }
  return { state: s, changed: true };
}

/** Ends everything now (final submission). Idempotent. */
export function finishAll(state: TimingState, now: number): { state: TimingState; changed: boolean } {
  const r = reconcile(state, now);
  const s = r.state;
  if (s.finished) return r;
  s.ends[s.index] = now;
  s.finished = true;
  s.finishedAt = now;
  return { state: s, changed: true };
}

/** Deadline of the current section (ms epoch), or null if untimed / finished. */
export function currentDeadline(state: TimingState): number | null {
  if (state.finished) return null;
  const d = state.durationsMs[state.index];
  const st = state.starts[state.index];
  return d == null || st == null ? null : st + d;
}

/** Total time actually spent across sections (ms). */
export function timeSpentMs(state: TimingState, now: number): number {
  let total = 0;
  for (let i = 0; i < state.starts.length; i++) {
    const st = state.starts[i];
    if (st == null) continue;
    const en = state.ends[i] ?? (state.finished ? st : now);
    total += Math.max(0, en - st);
  }
  return total;
}
