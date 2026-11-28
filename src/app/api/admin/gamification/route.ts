import { z } from "zod";
import { DEFAULT_XP_RULES } from "@/lib/gamify";
import { requireAdmin } from "@/lib/server/admin-session";
import { xpRules } from "@/lib/server/gamification";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { ranking } from "@/lib/server/leaderboard";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

/** Reward rules + leaderboard moderation view (top 100 all-time, with visibility). */
export const GET = route(async () => {
  await requireAdmin();
  const top = await ranking("all", null, 100);
  const ids = top.map((t) => t.user_id);
  const [profiles, lb, xpToday] = await Promise.all([
    ids.length ? sb().from("profiles").select("id, candidate_id, doc->>firstName, doc->>lastName").in("id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb().from("leaderboard_profiles").select("user_id, is_public, display_name, hidden_by_admin").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
    sb().from("xp_ledger").select("user_id, amount").gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  const p = new Map((must(profiles, "lb names") ?? []).map((r) => [r.id as string, r]));
  const v = new Map((must(lb, "lb vis") ?? []).map((r) => [r.user_id as string, r]));
  const day = new Map<string, number>();
  for (const r of must(xpToday, "xp today") ?? []) day.set(r.user_id as string, (day.get(r.user_id as string) ?? 0) + (r.amount as number));
  return ok({
    rules: await xpRules(),
    defaults: DEFAULT_XP_RULES,
    top: top.map((t) => {
      const pr = p.get(t.user_id);
      const vis = v.get(t.user_id);
      return {
        id: t.user_id,
        rank: t.rank,
        xp: t.xp,
        xp24h: day.get(t.user_id) ?? 0,
        name: pr ? `${pr.firstName} ${pr.lastName}` : "—",
        candidateId: pr?.candidate_id ?? "",
        isPublic: !!vis?.is_public,
        displayName: vis?.display_name ?? null,
        hidden: !!vis?.hidden_by_admin,
      };
    }),
  });
});

const n = z.number().int().min(0).max(1000);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rules"), rules: z.object({ challengeBase: n, bonus70: n, bonus90: n, streak7: n, mockPublished: n }) }),
  z.object({ action: z.literal("visibility"), userId: z.string().regex(/^[0-9a-f-]{36}$/i), hidden: z.boolean() }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Body.parse(await readJson(req));
  if (b.action === "rules") {
    must(await sb().from("app_settings").upsert({ key: "xp_rules", value: b.rules, updated_at: new Date().toISOString() }, { onConflict: "key" }), "xp rules save");
    await audit("xp.rules", "app_settings/xp_rules", b.rules);
    return ok({ rules: b.rules });
  }
  const exists = must(await sb().from("leaderboard_profiles").select("user_id").eq("user_id", b.userId).maybeSingle(), "lb exists");
  if (!exists && !b.hidden) throw new ApiError(404, "not_found", "Profil topilmadi.");
  must(await sb().from("leaderboard_profiles").upsert({ user_id: b.userId, hidden_by_admin: b.hidden, updated_at: new Date().toISOString() }, { onConflict: "user_id" }), "lb hide");
  await audit(b.hidden ? "leaderboard.hide" : "leaderboard.show", `profiles/${b.userId}`, {});
  return ok({ userId: b.userId, hidden: b.hidden });
});
