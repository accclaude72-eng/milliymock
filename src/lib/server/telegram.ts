import "server-only";

/*
 * Reports to the owner's Telegram through a bot. Secrets live only in server env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your chat id (send /start to the bot, then see README / admin "Agent" page)
 * Without them every call is a silent no-op, so the site never breaks because of Telegram.
 */
export function telegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `html` may contain <b>/<i>/<code> from our own templates; pass untrusted text through `plain`. */
export async function notifyTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  // Telegram limit is 4096 chars per message.
  const chunks: string[] = [];
  for (let i = 0; i < html.length; i += 3900) chunks.push(html.slice(i, i + 3900));
  try {
    for (const text of chunks) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: chunks.length > 1 ? undefined : "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn("[telegram] send failed", res.status);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn("[telegram] send failed", e);
    return false;
  }
}

/** Escapes text that came from users or from the agent before putting it in an HTML message. */
export function plain(s: string): string {
  return esc(s);
}
