import { ensureTodayChallenge } from "@/lib/server/challenges";
import { ok, route } from "@/lib/server/http";
import { todayUz } from "@/lib/server/plans";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Today's challenges with the student's own status (questions are only sent once an attempt starts). */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  await ensureTodayChallenge();
  const today = todayUz();
  const list = must(await sb().from("daily_challenges").select("id, day, subject_code, title, difficulty, question_ids, time_limit_sec, one_attempt, xp_base").eq("day", today).eq("status", "published").order("subject_code"), "today") ?? [];
  const mine = list.length
    ? (must(await sb().from("challenge_attempts").select("id, challenge_id, status, percent, correct, total, deadline_at").eq("user_id", user.uid).in("challenge_id", list.map((c) => c.id)).order("attempt_no"), "my today") ?? [])
    : [];
  const participants = list.length
    ? (must(await sb().from("challenge_attempts").select("challenge_id").in("challenge_id", list.map((c) => c.id)).eq("status", "submitted"), "participants") ?? [])
    : [];
  return ok({
    today,
    challenges: list.map((c) => {
      const my = mine.filter((a) => a.challenge_id === c.id);
      const open = my.find((a) => a.status === "in_progress" && Date.parse(a.deadline_at) > Date.now());
      const best = my.filter((a) => a.status !== "in_progress").sort((a, b) => Number(b.percent) - Number(a.percent))[0];
      return {
        id: c.id,
        subjectCode: c.subject_code,
        title: c.title,
        difficulty: c.difficulty,
        questions: (c.question_ids as string[]).length,
        timeLimitSec: c.time_limit_sec,
        oneAttempt: c.one_attempt,
        xp: c.xp_base,
        participants: participants.filter((p) => p.challenge_id === c.id).length,
        openAttemptId: open?.id ?? null,
        result: best ? { attemptId: best.id, percent: Number(best.percent), correct: best.correct, total: best.total, status: best.status } : null,
        canStart: !open && !(c.one_attempt && my.length > 0),
      };
    }),
  });
});
