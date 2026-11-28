import "server-only";
import { randomUUID } from "node:crypto";
import { type Layout, DISPLAY, challengeBonus, makeLayout, originalLetter, rng, shuffled } from "@/lib/gamify";
import { streak } from "@/lib/study-plan";
import { challengeDays, grantXp, refreshAchievements, xpRules } from "./gamification";
import { ApiError } from "./http";
import { todayUz } from "./plans";
import { type BankRow, bankRows, gradeBankAnswer, revealMap } from "./question-bank";
import { T, must, sb } from "./supabase";

export interface ChallengeRow {
  id: string;
  day: string;
  subject_code: string;
  title: string;
  difficulty: number | null;
  question_ids: string[];
  time_limit_sec: number;
  one_attempt: boolean;
  xp_base: number;
  status: "draft" | "published" | "archived";
  source: "auto" | "admin";
  created_at: string;
}

export interface AttemptRow {
  id: string;
  challenge_id: string;
  user_id: string;
  attempt_no: number;
  layout: Layout;
  answers: Record<string, string>;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  correct: number | null;
  total: number | null;
  percent: number | null;
  duration_ms: number | null;
  flagged: boolean;
}

const GRACE_MS = 15_000;
export const AUTO_COUNT = 10;
export const AUTO_SECONDS = 600;

/**
 * Single-choice bank questions usable in a challenge: active, from published tests that allow
 * revealing answers (results show the correct options afterwards).
 */
export async function challengePool(subject: string | null, difficulty: number | null = null): Promise<BankRow[]> {
  let q = sb().from("question_bank").select("*").eq("active", true).eq("type", "Y1");
  if (subject && subject !== "mixed") q = q.eq("subject_code", subject);
  if (difficulty) q = q.eq("difficulty", difficulty);
  const rows = (must(await q.limit(2000), "challenge pool") ?? []) as BankRow[];
  const reveal = await revealMap(rows.map((r) => r.material_id));
  const pub = new Set(must(await sb().from(T.materials).select("id").eq("status", "published").in("id", [...new Set(rows.map((r) => r.material_id))]), "pool published")?.map((r) => r.id as string));
  return rows.filter((r) => reveal.get(r.material_id)?.reveal && pub.has(r.material_id) && r.options.length >= 2);
}

/** Picks questions deterministically for a day, spreading across subjects for "mixed". */
export function pickQuestions(pool: BankRow[], count: number, seed: string): string[] {
  const r = rng(seed);
  const bySubject = new Map<string, BankRow[]>();
  for (const q of shuffled(pool, r)) bySubject.set(q.subject_code, [...(bySubject.get(q.subject_code) ?? []), q]);
  const lanes = shuffled([...bySubject.values()], r);
  const out: string[] = [];
  for (let i = 0; out.length < count && lanes.some((l) => l.length > i); i++) for (const l of lanes) if (l[i] && out.length < count) out.push(l[i].id);
  return out;
}

/** Today's mixed challenge exists (created automatically on first visit of the day). */
export async function ensureTodayChallenge(): Promise<void> {
  const day = todayUz();
  const exists = must(await sb().from("daily_challenges").select("id").eq("day", day).eq("subject_code", "mixed").maybeSingle(), "today challenge");
  if (exists) return;
  const ids = pickQuestions(await challengePool(null), AUTO_COUNT, `daily:${day}`);
  if (ids.length < 3) return; // not enough real questions yet
  // ignoreDuplicates: two first visitors at the same moment create it only once.
  must(
    await sb()
      .from("daily_challenges")
      .upsert({ day, subject_code: "mixed", title: "Kunlik challenge: aralash fanlar", question_ids: ids, time_limit_sec: AUTO_SECONDS, source: "auto" }, { onConflict: "day,subject_code", ignoreDuplicates: true }),
    "create today challenge",
  );
}

export async function getChallenge(id: string): Promise<ChallengeRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Challenge topilmadi.");
  const c = must(await sb().from("daily_challenges").select("*").eq("id", id).maybeSingle(), "challenge") as ChallengeRow | null;
  if (!c || c.status !== "published") throw new ApiError(404, "not_found", "Challenge topilmadi.");
  return c;
}

/** Starts (or resumes) the student's attempt. Only today's challenges can be taken. */
export async function startAttempt(uid: string, c: ChallengeRow): Promise<AttemptRow> {
  if (c.day !== todayUz()) throw new ApiError(409, "closed", "Bu challenge yopilgan — faqat o‘z kunida topshiriladi.");
  const mine = (must(await sb().from("challenge_attempts").select("*").eq("challenge_id", c.id).eq("user_id", uid).order("attempt_no"), "my attempts") ?? []) as AttemptRow[];
  const open = mine.find((a) => a.status === "in_progress");
  if (open) {
    if (Date.parse(open.deadline_at) + GRACE_MS > Date.now()) return open;
    await finish(uid, c, open, open.answers ?? {}, true).catch(() => undefined);
  }
  if (c.one_attempt && mine.length) throw new ApiError(409, "already_done", "Bu challenge’ni allaqachon topshirgansiz. Ertangisini kuting!");
  if (mine.length >= 20) throw new ApiError(409, "limit", "Urinishlar chegarasi tugadi.");
  const bank = await bankRows(c.question_ids);
  const id = randomUUID();
  const layout = makeLayout(
    c.question_ids.flatMap((q) => (bank.get(q) ? [{ id: q, letters: bank.get(q)!.options.map((o) => o.letter) }] : [])),
    id,
  );
  const { data, error } = await sb()
    .from("challenge_attempts")
    .insert({ id, challenge_id: c.id, user_id: uid, attempt_no: mine.length + 1, layout, deadline_at: new Date(Date.now() + c.time_limit_sec * 1000).toISOString() })
    .select("*")
    .single();
  if (error?.code === "23505") throw new ApiError(409, "busy", "Challenge allaqachon boshlangan. Sahifani yangilang.");
  return must({ data, error }, "start challenge") as AttemptRow;
}

/** Questions as this student sees them (own order, own option letters, no answers). */
export async function attemptView(a: AttemptRow) {
  const bank = await bankRows(a.layout.order);
  return a.layout.order.flatMap((qid) => {
    const q = bank.get(qid);
    if (!q) return [];
    const byLetter = new Map(q.options.map((o) => [o.letter, o.html]));
    return [{ id: qid, subjectCode: q.subject_code, topic: q.topic, stem: q.stem_html, options: (a.layout.options[qid] ?? []).map((orig, i) => ({ letter: DISPLAY[i], html: byLetter.get(orig) ?? "" })) }];
  });
}

/** Saves answers during the attempt (only before the deadline) — they survive a closed tab or lost connection. */
export async function saveAnswers(a: AttemptRow, answers: Record<string, string>): Promise<void> {
  if (a.status !== "in_progress") throw new ApiError(409, "done", "Bu urinish allaqachon yakunlangan.");
  if (Date.now() > Date.parse(a.deadline_at) + GRACE_MS) throw new ApiError(409, "time_up", "Vaqt tugadi.");
  must(await sb().from("challenge_attempts").update({ answers }).eq("id", a.id).eq("status", "in_progress"), "save challenge");
}

/**
 * Grades on the server, stores the result, grants XP and achievements. Idempotent per attempt.
 * `auto` = the server finishes an attempt whose time ran out, using the answers saved in time.
 */
export async function finish(uid: string, c: ChallengeRow, a: AttemptRow, answers: Record<string, string>, auto = false) {
  if (a.status !== "in_progress") throw new ApiError(409, "done", "Bu urinish allaqachon yakunlangan.");
  const now = Date.now();
  const late = !auto && now > Date.parse(a.deadline_at) + GRACE_MS;
  const bank = await bankRows(a.layout.order);
  let correct = 0;
  const marks: Record<string, { picked: string | null; correctDisplay: string | null; ok: boolean }> = {};
  for (const qid of a.layout.order) {
    const q = bank.get(qid);
    if (!q) continue;
    const shown = late ? null : (answers[qid] ?? null);
    const orig = shown ? originalLetter(a.layout, qid, shown) : null;
    const ok = !!orig && (await gradeBankAnswer(q, orig));
    if (ok) correct++;
    const idx = (a.layout.options[qid] ?? []).indexOf(q.correct);
    marks[qid] = { picked: shown, correctDisplay: idx >= 0 ? DISPLAY[idx] : null, ok };
  }
  const total = a.layout.order.length;
  const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
  const duration = Math.min(now, Date.parse(a.deadline_at)) - Date.parse(a.started_at);
  // Conditional update: only the first finisher of an attempt writes (parallel submits can't double-score).
  const upd = must(
    await sb()
      .from("challenge_attempts")
      .update({
        answers: late ? {} : answers,
        status: late ? "expired" : "submitted",
        submitted_at: new Date(now).toISOString(),
        correct,
        total,
        percent,
        duration_ms: Math.max(0, duration),
        flagged: !late && total > 0 && duration < total * 3000,
      })
      .eq("id", a.id)
      .eq("status", "in_progress")
      .select("id"),
    "finish challenge",
  );
  if (!upd?.length) throw new ApiError(409, "done", "Bu urinish allaqachon yakunlangan.");

  // Rewards only for an on-time finish of the challenge (one reward per challenge, whatever the attempt number).
  const xp: { reason: string; amount: number }[] = [];
  // Completion XP needs a real try: at least half of the questions answered (an empty submit earns nothing).
  const answered = Object.values(marks).filter((m) => m.picked).length;
  if (!late && answered * 2 >= total) {
    const rules = await xpRules();
    const subject = c.subject_code === "mixed" ? null : c.subject_code;
    if (await grantXp(uid, c.xp_base, "challenge", c.id, subject)) xp.push({ reason: "challenge", amount: c.xp_base });
    const bonus = challengeBonus(percent, rules);
    if (bonus && (await grantXp(uid, bonus, "challenge_bonus", c.id, subject))) xp.push({ reason: "challenge_bonus", amount: bonus });
    const s = streak(await challengeDays(uid), todayUz());
    if (s > 0 && s % 7 === 0 && (await grantXp(uid, rules.streak7, "streak", `${todayUz()}:${s}`))) xp.push({ reason: "streak", amount: rules.streak7 });
  }
  const achievements = await refreshAchievements(uid);
  return { correct, total, percent, late, marks, xp, achievements };
}
