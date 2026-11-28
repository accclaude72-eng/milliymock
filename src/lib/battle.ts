// Pure battle / social rules (shared by server and tests — no I/O here).
import { rng, shuffled } from "./gamify";

export const BATTLE_COUNT = 7;
export const BATTLE_SEC_PER_Q = 30;
/** Countdown between the opponent joining and the first question. */
export const BATTLE_LEAD_MS = 4_000;
export const BATTLE_GRACE_MS = 5_000;
/** A waiting battle nobody joined is closed after this long. */
export const BATTLE_WAIT_MS = 10 * 60_000;
/** A random-match lobby older than this is not offered to new players. */
export const RANDOM_MATCH_MS = 2 * 60_000;

export const BATTLE_XP = { win: 15, draw: 8, play: 5 } as const;

export interface SideResult {
  userId: string;
  correct: number;
  answered: number;
  /** Time of the last answer since the start (ms) — the tie-breaker. */
  lastMs: number;
}

/**
 * Winner = more correct answers; on a tie, whoever finished their answers faster
 * (only if both answered the same number). Otherwise a draw (null).
 */
export function decideWinner(a: SideResult, b: SideResult): string | null {
  if (a.correct !== b.correct) return a.correct > b.correct ? a.userId : b.userId;
  if (a.correct === 0) return null;
  if (a.answered === b.answered && a.lastMs !== b.lastMs) return a.lastMs < b.lastMs ? a.userId : b.userId;
  return null;
}

/** XP for one side. Needs a real try: at least half of the questions answered. */
export function battleXp(me: SideResult, winner: string | null, total: number): number {
  if (me.answered * 2 < total) return 0;
  if (winner === null) return BATTLE_XP.draw;
  return winner === me.userId ? BATTLE_XP.win : BATTLE_XP.play;
}

/** Same questions in the same order for both players; each player gets their own option order. */
export function optionOrder(battleId: string, userId: string, questionId: string, letters: string[]): string[] {
  return shuffled(letters, rng(`${battleId}:${userId}:${questionId}`));
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

export function randomCode(len: number, rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}

/** Shared pomodoro lengths. */
export const ROOM_TIMER_MIN = { focus: 25, break: 5 } as const;
/** A member counts as online if seen within this window (pages send a heartbeat every 20 s). */
export const ONLINE_MS = 60_000;

/** Fallback public name — never e-mail, real name or Candidate ID. */
export const anonName = (uid: string) => `Nomzod ${uid.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
