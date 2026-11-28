import { z } from "zod";
import { syncMockXp, xpRules } from "@/lib/server/gamification";
import { ok, route } from "@/lib/server/http";
import { publicStats, ranking, snapshotWeek } from "@/lib/server/leaderboard";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

const Q = z.object({
  period: z.enum(["day", "week", "month", "all"]).default("week"),
  subject: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable()
    .default(null),
  page: z.coerce.number().int().min(1).max(50).default(1),
  q: z.string().trim().max(40).default(""),
});

const PAGE = 20;

/**
 * XP ranking from the server-side ledger. Only students who opted in (and were not hidden by an
 * admin) are listed; ranks are among listed students. Your own position is shown either way.
 */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const sp = new URL(req.url).searchParams;
  const { period, subject, page, q } = Q.parse({ period: sp.get("period") ?? undefined, subject: sp.get("subject") || null, page: sp.get("page") ?? undefined, q: sp.get("q") ?? undefined });
  await syncMockXp(user.uid, await xpRules());
  await snapshotWeek().catch((e) => console.warn("[leaderboard] snapshot", e));

  const rows = await ranking(period, subject);
  const ids = rows.map((r) => r.user_id);
  const profiles = ids.length
    ? (must(await sb().from("leaderboard_profiles").select("user_id, display_name").in("user_id", ids).eq("is_public", true).eq("hidden_by_admin", false), "public profiles") ?? [])
    : [];
  const names = new Map(profiles.map((p) => [p.user_id as string, (p.display_name as string | null) ?? "Nomzod"]));
  let listed = rows.filter((r) => names.has(r.user_id)).map((r, i) => ({ ...r, rank: i + 1, name: names.get(r.user_id)! }));
  if (q) listed = listed.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const pageRows = listed.slice((page - 1) * PAGE, page * PAGE);
  const stats = await publicStats(pageRows.map((r) => r.user_id));

  const meAll = rows.find((r) => r.user_id === user.uid) ?? null;
  const meListed = listed.find((r) => r.user_id === user.uid) ?? null;
  const [mine, history] = await Promise.all([
    sb().from("leaderboard_profiles").select("is_public, display_name, hidden_by_admin").eq("user_id", user.uid).maybeSingle(),
    sb().from("leaderboard_snapshots").select("week_start, rank, xp").eq("user_id", user.uid).order("week_start", { ascending: false }).limit(12),
  ]);
  const my = must(mine, "my lb profile");
  return ok({
    period,
    subject,
    page,
    pages: Math.max(1, Math.ceil(listed.length / PAGE)),
    total: listed.length,
    rows: pageRows.map((r) => ({ id: r.user_id, rank: r.rank, name: r.name, xp: r.xp, me: r.user_id === user.uid, ...stats.get(r.user_id)! })),
    me: {
      xp: meAll?.xp ?? 0,
      rankAll: meAll?.rank ?? null, // among everyone (private)
      rankListed: meListed?.rank ?? null,
      isPublic: !!my?.is_public,
      hiddenByAdmin: !!my?.hidden_by_admin,
      displayName: (my?.display_name as string | null) ?? null,
      history: (must(history, "my history") ?? []).reverse(),
    },
  });
});
