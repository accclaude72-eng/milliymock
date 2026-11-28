import "server-only";
import { DEFAULT_XP_RULES, type XpRules, earnedAchievements } from "@/lib/gamify";
import { streak } from "@/lib/study-plan";
import { todayUz } from "./plans";
import { must, sb } from "./supabase";

/*
 * XP and achievements. Every reward is an insert into xp_ledger with a unique (user, reason, ref):
 * the database itself refuses a second copy, so retries / parallel requests can't farm XP.
 */
export async function xpRules(): Promise<XpRules> {
  const r = must(await sb().from("app_settings").select("value").eq("key", "xp_rules").maybeSingle(), "xp rules");
  return { ...DEFAULT_XP_RULES, ...((r?.value as Partial<XpRules>) ?? {}) };
}

export async function grantXp(uid: string, amount: number, reason: string, ref: string, subjectCode: string | null = null): Promise<boolean> {
  if (amount === 0) return false;
  const { data, error } = await sb()
    .from("xp_ledger")
    .upsert({ user_id: uid, amount, reason, ref, subject_code: subjectCode }, { onConflict: "user_id,reason,ref", ignoreDuplicates: true })
    .select("id");
  must({ data, error }, "grant xp");
  return (data?.length ?? 0) > 0;
}

/** Days (Uzbekistan time) with a finished challenge. */
export async function challengeDays(uid: string): Promise<string[]> {
  const rows = must(await sb().from("challenge_attempts").select("submitted_at").eq("user_id", uid).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(400), "challenge days") ?? [];
  return [...new Set(rows.map((r) => new Date(Date.parse(r.submitted_at) + 5 * 3600_000).toISOString().slice(0, 10)))];
}

/** +XP for each published mock result (idempotent, lazily applied). */
export async function syncMockXp(uid: string, rules: XpRules): Promise<void> {
  const rows = must(await sb().from("attempts").select("id, subject_code").eq("user_id", uid).eq("status", "published"), "mock xp") ?? [];
  if (!rows.length || !rules.mockPublished) return;
  must(
    await sb()
      .from("xp_ledger")
      .upsert(
        rows.map((r) => ({ user_id: uid, amount: rules.mockPublished, reason: "mock", ref: r.id as string, subject_code: r.subject_code as string })),
        { onConflict: "user_id,reason,ref", ignoreDuplicates: true },
      ),
    "mock xp grant",
  );
}

/** Re-evaluates achievements from real data and stores new ones. Returns newly earned codes. */
export async function refreshAchievements(uid: string): Promise<string[]> {
  const today = todayUz();
  const [days, ch, xp, mocks, have] = await Promise.all([
    challengeDays(uid),
    sb().from("challenge_attempts").select("percent").eq("user_id", uid).eq("status", "submitted"),
    sb().from("xp_ledger").select("amount").eq("user_id", uid),
    sb().from("attempts").select("subject_code, pct:doc->grading->summary->percent").eq("user_id", uid).eq("status", "published"),
    sb().from("student_achievements").select("code").eq("user_id", uid),
  ]);
  const percents = (must(ch, "ach challenges") ?? []).map((r) => Number(r.percent ?? 0));
  const bySubject: Record<string, { count: number; avg: number }> = {};
  for (const r of must(mocks, "ach mocks") ?? []) {
    const s = (bySubject[r.subject_code as string] ??= { count: 0, avg: 0 });
    s.avg = (s.avg * s.count + Number(r.pct ?? 0)) / (s.count + 1);
    s.count++;
  }
  const earned = earnedAchievements({
    challengesDone: percents.length,
    bestPercent: percents.length ? Math.max(...percents) : 0,
    streak: streak(days, today),
    challengeDays: days,
    today,
    totalXp: (must(xp, "ach xp") ?? []).reduce((s, r) => s + (r.amount as number), 0),
    mocks: bySubject,
  });
  const owned = new Set((must(have, "ach have") ?? []).map((r) => r.code as string));
  const fresh = earned.filter((c) => !owned.has(c));
  if (fresh.length) {
    must(await sb().from("student_achievements").upsert(fresh.map((code) => ({ user_id: uid, code })), { onConflict: "user_id,code", ignoreDuplicates: true }), "ach insert");
  }
  return fresh;
}
