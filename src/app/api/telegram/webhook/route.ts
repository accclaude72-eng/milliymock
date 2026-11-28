import { timingSafeEqual } from "node:crypto";
import { route } from "@/lib/server/http";
import { webhookSecret } from "@/lib/server/telegram";
import { handleUpdate } from "@/lib/server/telegram-bot";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Telegram bot webhook. Every call must carry the secret registered with setWebhook
 * (X-Telegram-Bot-Api-Secret-Token) — anything else is rejected without reading the body.
 * Authentic calls always get 200, so Telegram does not retry a failed command forever.
 */
export const POST = route(async (req) => {
  const secret = webhookSecret();
  if (!secret) return new Response("webhook not configured", { status: 503 });
  if (!same(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) return new Response("forbidden", { status: 403 });
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    console.warn("[telegram] update failed", e);
  }
  return Response.json({ ok: true });
});
