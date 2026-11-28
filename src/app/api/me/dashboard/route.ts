import { BATTLE_WAIT_MS } from "@/lib/battle";
import { streak } from "@/lib/study-plan";
import { ensureTodayChallenge } from "@/lib/server/challenges";
import { challengeDays, syncMockXp, xpRules } from "@/lib/server/gamification";
import { ok, route } from "@/lib/server/http";
import { ingestAttempts } from "@/lib/server/mistakes";
import { todayUz } from "@/lib/server/plans";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/**
 * "Bugun" block of the student dashboard in ONE request: everything is read in parallel
 * (each Supabase round trip costs latency), only counts and short lists are returned.
 */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const uid = user.uid;
  const day = todayUz();
  const nowIso = new Date().toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  // Lazy, idempotent catch-up (cheap id checks when nothing is new): today's challenge, mock XP, mistakes from new results.
  await Promise.all([ensureTodayChallenge().catch(() => undefined), xpRules().then((r) => syncMockXp(uid, r)), ingestAttempts(uid)]);

  const [xp, days, challenges, tasks, mistakes, mistakesOpen, cardsDue, invites, rooms, certs, tg, recentCards, recentPractice] = await Promise.all([
    sb().from("xp_ledger").select("amount, created_at").eq("user_id", uid).limit(10000),
    challengeDays(uid),
    sb().from("daily_challenges").select("id, title, question_ids, time_limit_sec").eq("day", day).eq("status", "published"),
    sb().from("study_plan_tasks").select("id, title, minutes, status, kind").eq("user_id", uid).eq("day", day).order("id"),
    sb().from("student_mistakes").select("id", { count: "exact", head: true }).eq("user_id", uid).neq("status", "resolved").lte("next_review_at", nowIso),
    sb().from("student_mistakes").select("id", { count: "exact", head: true }).eq("user_id", uid).neq("status", "resolved"),
    sb().from("flashcard_reviews").select("card_id", { count: "exact", head: true }).eq("user_id", uid).lte("due_on", day),
    sb()
      .from("battles")
      .select("id", { count: "exact", head: true })
      .eq("invited_user", uid)
      .eq("status", "waiting")
      .gte("created_at", new Date(Date.now() - BATTLE_WAIT_MS).toISOString()),
    sb().from("study_room_members").select("room_id", { count: "exact", head: true }).eq("user_id", uid),
    sb().from("certificates").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "valid"),
    sb().from("telegram_links").select("user_id").eq("user_id", uid).maybeSingle(),
    sb().from("flashcard_reviews").select("reviewed_at").eq("user_id", uid).gte("reviewed_at", since7).limit(2000),
    sb().from("answer_events").select("at").eq("user_id", uid).gte("at", since7).limit(2000),
  ]);

  const ledger = (must(xp, "dash xp") ?? []) as { amount: number; created_at: string }[];
  const ch = (must(challenges, "dash challenges") ?? []) as { id: string; title: string; question_ids: string[]; time_limit_sec: number }[];
  const done = ch.length
    ? new Set(
        (
          (must(
            await sb()
              .from("challenge_attempts")
              .select("challenge_id")
              .eq("user_id", uid)
              .in(
                "challenge_id",
                ch.map((c) => c.id),
              )
              .neq("status", "in_progress"),
            "dash done",
          ) ?? []) as { challenge_id: string }[]
        ).map((r) => r.challenge_id),
      )
    : new Set<string>();
  const t = (must(tasks, "dash tasks") ?? []) as { id: number; title: string; minutes: number | null; status: string; kind: string }[];

  // Last 7 Uzbekistan days: a day counts as active with a challenge, a flashcard review or a graded answer.
  const uzDay = (iso: string) => new Date(Date.parse(iso) + 5 * 3600_000).toISOString().slice(0, 10);
  const active = new Set<string>([
    ...days,
    ...((must(recentCards, "dash cards 7d") ?? []) as { reviewed_at: string | null }[]).flatMap((r) => (r.reviewed_at ? [uzDay(r.reviewed_at)] : [])),
    ...((must(recentPractice, "dash practice 7d") ?? []) as { at: string }[]).map((r) => uzDay(r.at)),
  ]);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(`${day}T00:00:00Z`) - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, active: active.has(d) };
  });

  return ok({
    week,
    xp: { total: ledger.reduce((s, r) => s + Number(r.amount), 0), week: ledger.filter((r) => r.created_at >= since7).reduce((s, r) => s + Number(r.amount), 0) },
    streak: streak(days, day),
    challenges: ch.map((c) => ({ id: c.id, title: c.title, questions: c.question_ids.length, minutes: Math.round(c.time_limit_sec / 60), done: done.has(c.id) })),
    plan: {
      total: t.length,
      done: t.filter((x) => x.status === "done").length,
      next: t
        .filter((x) => x.status === "todo")
        .slice(0, 3)
        .map((x) => ({ title: x.title, minutes: x.minutes })),
    },
    mistakesDue: mistakes.count ?? 0,
    mistakesOpen: mistakesOpen.count ?? 0,
    cardsDue: cardsDue.count ?? 0,
    battleInvites: invites.count ?? 0,
    rooms: rooms.count ?? 0,
    certificates: certs.count ?? 0,
    telegramLinked: !!must(tg, "dash tg"),
  });
});
