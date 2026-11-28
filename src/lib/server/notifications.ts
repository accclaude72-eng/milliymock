import "server-only";
import { inQuietHours, uzHour } from "@/lib/certificate";
import { must, sb } from "./supabase";
import { sendTelegramTo } from "./telegram";

export type NotifyKind = "results" | "daily_challenge" | "plan_reminders" | "battle_invites" | "mistakes_due";

export interface Prefs {
  results: boolean;
  daily_challenge: boolean;
  plan_reminders: boolean;
  battle_invites: boolean;
  mistakes_due: boolean;
  quiet_from: number | null;
  quiet_to: number | null;
}
export const DEFAULT_PREFS: Prefs = { results: true, daily_challenge: true, plan_reminders: true, battle_invites: true, mistakes_due: false, quiet_from: null, quiet_to: null };

/** Absolute site URL for links in messages (env first; request origin as a fallback). */
export function siteBase(fallback?: string): string {
  const v = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    fallback ||
    ""
  ).trim();
  return v.replace(/\/$/, "");
}

export async function prefsOf(uid: string): Promise<Prefs> {
  const p = must(await sb().from("notification_prefs").select("*").eq("user_id", uid).maybeSingle(), "prefs");
  return p ? { ...DEFAULT_PREFS, ...(p as Partial<Prefs>) } : DEFAULT_PREFS;
}

/**
 * Sends one Telegram message to a student — at most once per (user, kind, ref), only if they
 * linked the bot and allowed this kind, and not during their quiet hours (then it is skipped,
 * unless `urgent`). Never throws: notifications must not break the action that triggered them.
 */
export async function notifyUser(
  uid: string,
  kind: NotifyKind | "system",
  ref: string,
  html: string,
  opts: { buttons?: { text: string; url: string }[]; urgent?: boolean } = {},
): Promise<"sent" | "skipped" | "failed" | "duplicate"> {
  try {
    const link = must(await sb().from("telegram_links").select("chat_id").eq("user_id", uid).maybeSingle(), "tg link");
    if (!link) return "skipped";
    if (kind !== "system") {
      const prefs = await prefsOf(uid);
      if (!prefs[kind]) return "skipped";
      if (!opts.urgent && inQuietHours(uzHour(Date.now()), prefs.quiet_from, prefs.quiet_to)) return "skipped";
    }
    // Claim the (user, kind, ref) slot first — a parallel or repeated trigger finds it taken.
    const { error } = await sb()
      .from("notification_log")
      .insert({ user_id: uid, kind, ref: ref.slice(0, 120), status: "sent" });
    if (error?.code === "23505") return "duplicate";
    if (error) throw new Error(error.message);
    const r = await sendTelegramTo(String(link.chat_id), html, opts.buttons);
    if (!r.ok) {
      await sb()
        .from("notification_log")
        .update({ status: "failed", error: (r.error ?? "").slice(0, 300) })
        .eq("user_id", uid)
        .eq("kind", kind)
        .eq("ref", ref.slice(0, 120));
      // The student blocked the bot → unlink so we stop trying.
      if (/bloklagansiz|Chat topilmadi|birinchi bo‘lib yoza olmaydi/i.test(r.error ?? "")) await sb().from("telegram_links").delete().eq("user_id", uid);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.warn("[notify]", kind, e);
    return "failed";
  }
}

/** "Natija e’lon qilindi" — sent once per attempt (dedupe by attempt id). */
export async function notifyResultPublished(a: { id: string; uid: string; materialTitle: string; grading: { summary: { percent: number; score: number; max: number } } | null }): Promise<void> {
  const s = a.grading?.summary;
  if (!s) return;
  const base = siteBase();
  await notifyUser(
    a.uid,
    "results",
    `result:${a.id}`,
    `📊 <b>Natijangiz e’lon qilindi</b>\n${a.materialTitle.replace(/[<>&]/g, "")}\nXom ball: <b>${s.score}/${s.max}</b> (${Math.round(s.percent * 10) / 10}%)`,
    base ? { buttons: [{ text: "Natijani ko‘rish", url: `${base}/natija/${a.id}` }] } : {},
  );
}
