import { timingSafeEqual } from "node:crypto";
import { inQuietHours, uzHour } from "@/lib/certificate";
import { route } from "@/lib/server/http";
import { DEFAULT_PREFS, type Prefs, notifyUser, siteBase } from "@/lib/server/notifications";
import { todayUz } from "@/lib/server/plans";
import { must, sb } from "@/lib/server/supabase";
import { morningDigest } from "@/lib/server/telegram-bot";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Morning digest on Telegram (Vercel Cron, see vercel.json — 08:00 Tashkent). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; without that secret nothing runs.
 * One message per student per day (deduplicated in notification_log).
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new Response("cron not configured", { status: 503 });
  if (!same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("forbidden", { status: 403 });
  const links = (must(await sb().from("telegram_links").select("user_id").limit(5000), "cron links") ?? []) as { user_id: string }[];
  const prefRows = links.length
    ? ((must(
        await sb()
          .from("notification_prefs")
          .select("*")
          .in(
            "user_id",
            links.map((l) => l.user_id),
          ),
        "cron prefs",
      ) ?? []) as (Prefs & { user_id: string })[])
    : [];
  const byUser = new Map(prefRows.map((p) => [p.user_id, { ...DEFAULT_PREFS, ...p }]));
  const day = todayUz();
  const base = siteBase(new URL(req.url).origin);
  let sent = 0;
  for (const l of links) {
    const p = byUser.get(l.user_id) ?? DEFAULT_PREFS;
    if (inQuietHours(uzHour(Date.now()), p.quiet_from, p.quiet_to)) continue;
    const text = await morningDigest(l.user_id, p);
    if (!text) continue;
    if ((await notifyUser(l.user_id, "system", `digest:${day}`, text, base ? { buttons: [{ text: "Saytni ochish", url: `${base}/kabinet` }] } : {})) === "sent") sent++;
    await new Promise((r) => setTimeout(r, 40)); // well under Telegram's 30 messages per second
  }
  return Response.json({ ok: true, day, linked: links.length, sent });
});
