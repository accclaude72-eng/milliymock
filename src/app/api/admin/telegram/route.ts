import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { siteBase } from "@/lib/server/notifications";
import { audit } from "@/lib/server/repo";
import { sb } from "@/lib/server/supabase";
import { botApi, botUsername, telegramToken, webhookSecret } from "@/lib/server/telegram";
import { COMMANDS } from "@/lib/server/telegram-bot";

interface WebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
}

/** Bot status: webhook info (no secrets), linked students, recent sends. */
export const GET = route(async () => {
  await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [linked, sent, failed] = await Promise.all([
    sb().from("telegram_links").select("user_id", { count: "exact", head: true }),
    sb().from("notification_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", weekAgo),
    sb().from("notification_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", weekAgo),
  ]);
  const info = telegramToken() ? await botApi<WebhookInfo>("getWebhookInfo") : null;
  return ok({
    tokenSet: !!telegramToken(),
    secretSet: !!webhookSecret(),
    cronSet: !!process.env.CRON_SECRET,
    bot: telegramToken() ? await botUsername() : null,
    webhook: info?.ok
      ? {
          url: info.result?.url ?? "",
          pending: info.result?.pending_update_count ?? 0,
          lastError: info.result?.last_error_message ?? null,
          lastErrorAt: info.result?.last_error_date ? info.result.last_error_date * 1000 : null,
        }
      : null,
    linked: linked.count ?? 0,
    sent7d: sent.count ?? 0,
    failed7d: failed.count ?? 0,
  });
});

const Body = z.object({ action: z.enum(["set_webhook", "delete_webhook"]) });

/** Registers the webhook (with our secret) and the command menu. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { action } = Body.parse(await readJson(req));
  if (!telegramToken()) throw new ApiError(400, "no_token", "TELEGRAM_BOT_TOKEN sozlanmagan.");
  if (action === "delete_webhook") {
    const r = await botApi("deleteWebhook", { drop_pending_updates: true });
    if (!r.ok) throw new ApiError(502, "telegram", `Telegram: ${r.description ?? "xato"}`);
    await audit("telegram.webhook_deleted", "telegram", {});
    return ok({ done: true });
  }
  const secret = webhookSecret();
  if (!secret) throw new ApiError(400, "no_secret", "Avval Vercel’da TELEGRAM_WEBHOOK_SECRET ni qo‘shing (kamida 16 ta harf/raqam).");
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) throw new ApiError(400, "bad_secret", "TELEGRAM_WEBHOOK_SECRET faqat harf, raqam, “_” va “-” dan iborat, 16–256 belgi bo‘lishi kerak.");
  const base = siteBase(new URL(req.url).origin);
  if (!base.startsWith("https://")) throw new ApiError(400, "not_https", "Webhook faqat https manzilda ishlaydi — bu tugmani joylangan saytda (Vercel) bosing.");
  const url = `${base}/api/telegram/webhook`;
  const r = await botApi("setWebhook", { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true });
  if (!r.ok) throw new ApiError(502, "telegram", `Telegram: ${r.description ?? "xato"}`);
  await botApi("setMyCommands", { commands: COMMANDS });
  await audit("telegram.webhook_set", "telegram", { url });
  return ok({ url });
});
