import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { pingAgent } from "@/lib/server/agent";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { notifyTelegram } from "@/lib/server/telegram";

export const maxDuration = 90;

const Body = z.object({ what: z.enum(["agent", "telegram", "telegram_chats"]) });

/**
 * Connection checks from the admin "Agent" page:
 *  - agent: one short message to Base44
 *  - telegram: test message to TELEGRAM_CHAT_ID
 *  - telegram_chats: lists chats that recently wrote to the bot, to find your chat id
 */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { what } = Body.parse(await readJson(req));
  if (!(await rateLimit(`agent:check:${what}`, 5, 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p tekshiruv. Bir daqiqadan so‘ng urinib ko‘ring.");
  if (what === "agent") return ok({ reply: await pingAgent() });
  if (what === "telegram") {
    const sent = await notifyTelegram("✅ Milliy Mock: Telegram ulanishi ishlayapti. Agent hisobotlari shu yerga keladi.");
    if (!sent) throw new ApiError(502, "telegram_failed", "Telegramga yuborilmadi. TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID ni tekshiring (botga avval /start yozing).");
    return ok({ sent });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new ApiError(503, "telegram_not_configured", "Avval TELEGRAM_BOT_TOKEN ni qo‘shing.");
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const j = (await res?.json().catch(() => null)) as { ok?: boolean; result?: { message?: { chat?: { id: number; first_name?: string; username?: string; title?: string } } }[] } | null;
  if (!j?.ok) throw new ApiError(502, "telegram_failed", "Bot tokeni noto‘g‘ri yoki Telegram javob bermadi.");
  const chats = new Map<number, string>();
  for (const u of j.result ?? []) {
    const c = u.message?.chat;
    if (c) chats.set(c.id, c.title ?? [c.first_name, c.username ? `@${c.username}` : ""].filter(Boolean).join(" "));
  }
  return ok({ chats: [...chats].map(([id, name]) => ({ id, name })) });
});
