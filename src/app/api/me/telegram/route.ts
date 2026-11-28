import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { DEFAULT_PREFS, notifyUser, prefsOf } from "@/lib/server/notifications";
import { rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { botUsername, telegramToken } from "@/lib/server/telegram";
import { createLinkCode } from "@/lib/server/telegram-bot";
import { requireCandidate } from "@/lib/server/user-auth";

/** Link status + notification settings. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const [link, prefs, log] = await Promise.all([
    sb().from("telegram_links").select("username, linked_at").eq("user_id", user.uid).maybeSingle(),
    prefsOf(user.uid),
    sb().from("notification_log").select("kind, status, created_at").eq("user_id", user.uid).order("created_at", { ascending: false }).limit(10),
  ]);
  const l = must(link, "tg link");
  return ok({
    botReady: !!telegramToken(),
    bot: telegramToken() ? await botUsername() : null,
    linked: !!l,
    username: (l?.username as string | null) ?? null,
    linkedAt: l?.linked_at ?? null,
    prefs,
    recent: must(log, "tg log") ?? [],
  });
});

const hour = z.number().int().min(0).max(23).nullable();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("link") }),
  z.object({ action: z.literal("unlink") }),
  z.object({ action: z.literal("test") }),
  z.object({
    action: z.literal("prefs"),
    results: z.boolean(),
    daily_challenge: z.boolean(),
    plan_reminders: z.boolean(),
    battle_invites: z.boolean(),
    mistakes_due: z.boolean(),
    quiet_from: hour,
    quiet_to: hour,
  }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const b = Body.parse(await readJson(req));
  if (b.action === "link") {
    if (!telegramToken()) throw new ApiError(503, "bot_off", "Telegram bot hali sozlanmagan. Administrator bilan bog‘laning.");
    if (!(await rateLimit(`tglink:${user.uid}`, 10, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
    const r = await createLinkCode(user.uid);
    if (!r.url) throw new ApiError(503, "bot_off", "Bot nomini aniqlab bo‘lmadi. TELEGRAM_BOT_TOKEN to‘g‘riligini tekshiring.");
    return ok({ url: r.url, expiresAt: r.expiresAt });
  }
  if (b.action === "unlink") {
    must(await sb().from("telegram_links").delete().eq("user_id", user.uid), "unlink");
    return ok({ linked: false });
  }
  if (b.action === "test") {
    if (!(await rateLimit(`tgtest:${user.uid}`, 5, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p sinov xabari. Birozdan so‘ng urinib ko‘ring.");
    const r = await notifyUser(user.uid, "system", `test:${Date.now()}`, "🔔 Sinov xabari: bildirishnomalar ishlayapti!");
    if (r !== "sent") throw new ApiError(409, "not_sent", r === "skipped" ? "Avval Telegram hisobingizni ulang." : "Xabar yuborilmadi. Botni bloklamaganingizni tekshiring.");
    return ok({ sent: true });
  }
  const prefs = {
    results: b.results,
    daily_challenge: b.daily_challenge,
    plan_reminders: b.plan_reminders,
    battle_invites: b.battle_invites,
    mistakes_due: b.mistakes_due,
    quiet_from: b.quiet_from,
    quiet_to: b.quiet_to,
  };
  must(
    await sb()
      .from("notification_prefs")
      .upsert({ user_id: user.uid, ...DEFAULT_PREFS, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
    "save prefs",
  );
  return ok({ prefs });
});
