import { ACHIEVEMENTS } from "@/lib/gamify";
import { streak } from "@/lib/study-plan";
import { challengeDays, refreshAchievements, syncMockXp, xpRules } from "@/lib/server/gamification";
import { ok, route } from "@/lib/server/http";
import { todayUz } from "@/lib/server/plans";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** XP, streak, achievements and challenge history — all from the student's own server records. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  await syncMockXp(user.uid, await xpRules());
  await refreshAchievements(user.uid);
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [xp, ach, hist, days] = await Promise.all([
    sb().from("xp_ledger").select("amount, reason, ref, created_at").eq("user_id", user.uid).order("created_at", { ascending: false }).limit(2000),
    sb().from("student_achievements").select("code, earned_at").eq("user_id", user.uid),
    sb()
      .from("challenge_attempts")
      .select("id, status, percent, correct, total, duration_ms, submitted_at, daily_challenges(title, day, subject_code)")
      .eq("user_id", user.uid)
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: false })
      .limit(30),
    challengeDays(user.uid),
  ]);
  const ledger = must(xp, "xp") ?? [];
  const earned = new Map((must(ach, "ach") ?? []).map((a) => [a.code as string, a.earned_at as string]));
  return ok({
    totalXp: ledger.reduce((s, r) => s + (r.amount as number), 0),
    weekXp: ledger.filter((r) => r.created_at >= since7).reduce((s, r) => s + (r.amount as number), 0),
    streak: streak(days, todayUz()),
    recentXp: ledger.slice(0, 10),
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, earnedAt: earned.get(a.code) ?? null })),
    history: (must(hist, "history") ?? []).map((h) => {
      const c = h.daily_challenges as unknown as { title: string; day: string; subject_code: string } | null;
      return { id: h.id, status: h.status, percent: Number(h.percent), correct: h.correct, total: h.total, durationMs: h.duration_ms, submittedAt: h.submitted_at, title: c?.title ?? "", day: c?.day ?? "", subjectCode: c?.subject_code ?? "" };
    }),
  });
});
