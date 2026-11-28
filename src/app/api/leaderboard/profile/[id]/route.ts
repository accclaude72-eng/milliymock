import { ACHIEVEMENTS } from "@/lib/gamify";
import { ApiError, ok, route } from "@/lib/server/http";
import { publicStats } from "@/lib/server/leaderboard";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Public profile card — only for students who opted in. Never shows e-mail, Candidate ID or answers. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireCandidate(req);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Profil topilmadi.");
  const p = must(await sb().from("leaderboard_profiles").select("display_name, is_public, hidden_by_admin").eq("user_id", id).maybeSingle(), "pub profile");
  if (!p?.is_public || p.hidden_by_admin) throw new ApiError(404, "not_found", "Profil topilmadi yoki yopiq.");
  const [xp, ach, stats] = await Promise.all([
    sb().from("xp_ledger").select("amount").eq("user_id", id),
    sb().from("student_achievements").select("code, earned_at").eq("user_id", id),
    publicStats([id]),
  ]);
  const earned = new Map((must(ach, "pub ach") ?? []).map((a) => [a.code as string, a.earned_at as string]));
  return ok({
    name: p.display_name ?? "Nomzod",
    xp: (must(xp, "pub xp") ?? []).reduce((s, r) => s + (r.amount as number), 0),
    ...stats.get(id)!,
    achievements: ACHIEVEMENTS.filter((a) => earned.has(a.code)).map((a) => ({ ...a, earnedAt: earned.get(a.code) })),
  });
});
