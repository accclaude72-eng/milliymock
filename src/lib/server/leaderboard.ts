import "server-only";
import { must, sb } from "./supabase";

export type Period = "day" | "week" | "month" | "all";

/** Window start. "day" = since midnight in Uzbekistan (UTC+5). */
export function sinceOf(period: Period, now = Date.now()): string {
  if (period === "all") return "2000-01-01T00:00:00Z";
  if (period === "day") {
    const uz = new Date(now + 5 * 3600_000);
    return new Date(Date.UTC(uz.getUTCFullYear(), uz.getUTCMonth(), uz.getUTCDate()) - 5 * 3600_000).toISOString();
  }
  return new Date(now - (period === "week" ? 7 : 30) * 86_400_000).toISOString();
}

/** Monday (YYYY-MM-DD, Uzbekistan) of the current week. */
export function weekStart(now = Date.now()): string {
  const uz = new Date(now + 5 * 3600_000);
  const dow = (uz.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(uz.getUTCFullYear(), uz.getUTCMonth(), uz.getUTCDate() - dow)).toISOString().slice(0, 10);
}

export async function ranking(period: Period, subject: string | null, limit = 500): Promise<{ user_id: string; xp: number; rank: number }[]> {
  const { data, error } = await sb().rpc("xp_ranking", { p_since: sinceOf(period), p_subject: subject, p_limit: limit, p_offset: 0 });
  return (must({ data, error }, "xp ranking") ?? []).map((r: { user_id: string; xp: number; rank: number }) => ({ user_id: r.user_id, xp: Number(r.xp), rank: Number(r.rank) }));
}

/** Once per week: stores everyone's all-time rank → ranking history. */
export async function snapshotWeek(): Promise<void> {
  const week = weekStart();
  const have = must(await sb().from("leaderboard_snapshots").select("user_id").eq("week_start", week).limit(1), "snapshot have");
  if (have?.length) return;
  const rows = await ranking("all", null, 500);
  if (!rows.length) return;
  must(
    await sb()
      .from("leaderboard_snapshots")
      .upsert(rows.map((r) => ({ week_start: week, user_id: r.user_id, rank: r.rank, xp: r.xp })), { onConflict: "week_start,user_id", ignoreDuplicates: true }),
    "snapshot insert",
  );
}

/** Public stats for a set of students: mocks completed, average result, achievements. */
export async function publicStats(ids: string[]) {
  if (!ids.length) return new Map<string, { mocks: number; avg: number | null; achievements: number }>();
  const [att, ach] = await Promise.all([
    sb().from("attempts").select("user_id, pct:doc->grading->summary->percent").in("user_id", ids).eq("status", "published"),
    sb().from("student_achievements").select("user_id").in("user_id", ids),
  ]);
  const out = new Map<string, { mocks: number; sum: number; achievements: number }>();
  for (const id of ids) out.set(id, { mocks: 0, sum: 0, achievements: 0 });
  for (const r of must(att, "pub attempts") ?? []) {
    const s = out.get(r.user_id as string)!;
    s.mocks++;
    s.sum += Number(r.pct ?? 0);
  }
  for (const r of must(ach, "pub ach") ?? []) out.get(r.user_id as string)!.achievements++;
  return new Map([...out].map(([k, v]) => [k, { mocks: v.mocks, avg: v.mocks ? Math.round((v.sum / v.mocks) * 10) / 10 : null, achievements: v.achievements }]));
}
