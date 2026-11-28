/**
 * Mistake notebook spaced repetition (pure, unit tested).
 * Stage 0..3 → next review after 1, 3, 7, 14 days. A wrong answer resets to stage 0 (tomorrow).
 * Three correct answers in a row → the mistake is resolved.
 */
export const REVIEW_DAYS = [1, 3, 7, 14] as const;
export const RESOLVE_STREAK = 3;
const DAY = 86_400_000;

export interface MistakeState {
  wrong_count: number;
  correct_streak: number;
  review_stage: number;
  status: "open" | "understood" | "resolved";
  next_review_at: string;
}

export function afterWrong(prev: MistakeState | null, now: number): MistakeState {
  return {
    wrong_count: (prev?.wrong_count ?? 0) + 1,
    correct_streak: 0,
    review_stage: 0,
    status: "open",
    next_review_at: new Date(now + REVIEW_DAYS[0] * DAY).toISOString(),
  };
}

export function afterCorrect(prev: MistakeState, now: number): MistakeState {
  const streak = prev.correct_streak + 1;
  const stage = Math.min(prev.review_stage + 1, REVIEW_DAYS.length - 1);
  return {
    wrong_count: prev.wrong_count,
    correct_streak: streak,
    review_stage: stage,
    status: streak >= RESOLVE_STREAK ? "resolved" : prev.status === "understood" ? "understood" : "open",
    next_review_at: new Date(now + REVIEW_DAYS[stage] * DAY).toISOString(),
  };
}
