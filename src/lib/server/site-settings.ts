import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type ThemeId, isThemeId } from "@/lib/themes";
import type { PaymentSettings } from "@/lib/types";
import { ApiError } from "./http";
import { T, sb, supabaseConfigured } from "./supabase";

/*
 * Site-wide design theme. Every change is written to the audit log as a "site.theme" entry, and
 * the newest entry is the active theme — so there is no extra table (no migration) and the full
 * change history is kept. Read server-side only, through the secret key.
 */
export const SITE_THEME_TAG = "site-theme";
const ACTION = "site.theme";

export interface SiteThemeState {
  theme: ThemeId;
  /** ISO time of the last change; null = never changed (original design). */
  changedAt: string | null;
}

/** Newest audit entry for a settings action (the audit log is append-only, so this is the current value). */
async function latest(action: string): Promise<{ at: string; details: Record<string, unknown> } | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await sb().from(T.audit).select("at, details").eq("action", action).order("at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function readSiteTheme(): Promise<SiteThemeState> {
  const data = await latest(ACTION);
  const theme = data?.details?.theme;
  return isThemeId(theme) ? { theme, changedAt: data!.at } : { theme: "default", changedAt: null };
}

/** Active theme for page rendering — cached, invalidated with revalidateTag when an admin changes it. */
export async function getSiteTheme(): Promise<ThemeId> {
  "use cache";
  cacheTag(SITE_THEME_TAG);
  cacheLife("days");
  try {
    return (await readSiteTheme()).theme;
  } catch (e) {
    console.warn("[theme] read failed, using default", e);
    return "default";
  }
}

export async function writeSiteTheme(theme: ThemeId, previous: ThemeId): Promise<void> {
  const { error } = await sb().from(T.audit).insert({ actor: "admin", action: ACTION, target: "site/theme", details: { theme, previous } });
  if (error) {
    console.error("[theme] write failed", error);
    throw new ApiError(500, "db_error", "Dizaynni saqlab bo‘lmadi.");
  }
}

/* ------------------------------------------------------------ payment card */

const PAYMENT_ACTION = "site.payment";
const EMPTY_PAYMENT: PaymentSettings = { cardNumber: "", cardHolder: "", instructions: "" };

export async function readPaymentSettings(): Promise<PaymentSettings & { changedAt: string | null }> {
  const d = await latest(PAYMENT_ACTION);
  const v = (d?.details ?? {}) as Partial<PaymentSettings>;
  return {
    cardNumber: typeof v.cardNumber === "string" ? v.cardNumber : "",
    cardHolder: typeof v.cardHolder === "string" ? v.cardHolder : "",
    instructions: typeof v.instructions === "string" ? v.instructions : EMPTY_PAYMENT.instructions,
    changedAt: d?.at ?? null,
  };
}

export async function writePaymentSettings(v: PaymentSettings, actor: "admin" | "agent" = "admin"): Promise<void> {
  const { error } = await sb().from(T.audit).insert({ actor, action: PAYMENT_ACTION, target: "site/payment", details: v });
  if (error) {
    console.error("[payment] settings write failed", error);
    throw new ApiError(500, "db_error", "To‘lov rekvizitlarini saqlab bo‘lmadi.");
  }
}
