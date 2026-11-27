import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { type ThemeId, isThemeId } from "@/lib/themes";
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

export async function readSiteTheme(): Promise<SiteThemeState> {
  if (!supabaseConfigured()) return { theme: "default", changedAt: null };
  const { data, error } = await sb().from(T.audit).select("at, details").eq("action", ACTION).order("at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
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
