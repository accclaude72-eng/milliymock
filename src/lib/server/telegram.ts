import "server-only";

/*
 * Reports to the owner's Telegram through a bot. Secrets live only in server env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your chat id (send /start to the bot, then "Chat ID ni topish" on the admin AI agent page)
 * Without them every call is a silent no-op, so the site never breaks because of Telegram.
 */

/** Env values pasted into a dashboard often carry spaces, newlines or quotes — strip them. */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const botToken = () => clean(process.env.TELEGRAM_BOT_TOKEN).replace(/^bot/i, "");
const chatId = () => clean(process.env.TELEGRAM_CHAT_ID);

export function telegramConfigured(): boolean {
  return !!(botToken() && chatId());
}

export function telegramToken(): string {
  return botToken();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Explains Telegram's error in plain Uzbek (never includes the token). */
function explain(status: number, description: string): string {
  const d = description.toLowerCase();
  if (status === 401 || d.includes("unauthorized")) return "Bot tokeni noto‘g‘ri (TELEGRAM_BOT_TOKEN). BotFather bergan tokenni to‘liq, bo‘sh joysiz qayta kiriting.";
  if (d.includes("chat not found")) return "Chat topilmadi: TELEGRAM_CHAT_ID noto‘g‘ri yoki siz bu botga hali /start yozmagansiz.";
  if (d.includes("bot was blocked")) return "Siz botni bloklagansiz. Telegramda botni oching va “Restart / Unblock” bosing.";
  if (d.includes("bot can't initiate") || d.includes("forbidden")) return "Bot sizga birinchi bo‘lib yoza olmaydi: Telegramda botni ochib /start yuboring.";
  return `Telegram xatosi (${status}): ${description || "noma’lum"}`;
}

export interface TelegramResult {
  ok: boolean;
  error?: string;
}

/** Sends and reports why it failed. `html` may contain <b>/<i>/<code> from our own templates; pass untrusted text through `plain`. */
export async function sendTelegram(html: string): Promise<TelegramResult> {
  const chat = chatId();
  if (!botToken() || !chat) return { ok: false, error: "TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan." };
  if (!/^-?\d{5,20}$/.test(chat)) return { ok: false, error: `TELEGRAM_CHAT_ID faqat raqamdan iborat bo‘lishi kerak (hozir: “${chat.slice(0, 20)}”).` };
  return sendTelegramTo(chat, html);
}

/** Sends to any chat (e.g. a student who linked the bot). Never throws. */
export async function sendTelegramTo(chat: string | number, html: string, buttons?: { text: string; url: string }[]): Promise<TelegramResult> {
  const token = botToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan." };
  // Telegram limit is 4096 chars per message.
  const chunks: string[] = [];
  for (let i = 0; i < html.length; i += 3900) chunks.push(html.slice(i, i + 3900));
  try {
    for (const text of chunks) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text,
          parse_mode: chunks.length > 1 ? undefined : "HTML",
          disable_web_page_preview: true,
          ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) } } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { description?: string } | null;
        const error = explain(res.status, j?.description ?? "");
        console.warn("[telegram] send failed", res.status, j?.description);
        return { ok: false, error };
      }
    }
    return { ok: true };
  } catch (e) {
    console.warn("[telegram] send failed", e);
    return { ok: false, error: "Telegram serveriga ulanib bo‘lmadi." };
  }
}

/** Fire-and-forget variant used by reports: never throws. */
export async function notifyTelegram(html: string): Promise<boolean> {
  return (await sendTelegram(html)).ok;
}

/** Escapes text that came from users or from the agent before putting it in an HTML message. */
export function plain(s: string): string {
  return esc(s);
}

/** Secret Telegram sends in the X-Telegram-Bot-Api-Secret-Token header of every webhook call. */
export const webhookSecret = () => clean(process.env.TELEGRAM_WEBHOOK_SECRET);

/** Calls a Bot API method (server only). Never throws. */
export async function botApi<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = botToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN sozlanmagan." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch {
    return { ok: false, description: "Telegram serveriga ulanib bo‘lmadi." };
  }
}

let usernameCache: string | null = null;
/** The bot's @username (for t.me deep links). */
export async function botUsername(): Promise<string | null> {
  if (usernameCache) return usernameCache;
  const env = clean(process.env.TELEGRAM_BOT_USERNAME).replace(/^@/, "");
  if (env) return (usernameCache = env);
  const r = await botApi<{ username?: string }>("getMe");
  return (usernameCache = r.ok ? (r.result?.username ?? null) : null);
}
