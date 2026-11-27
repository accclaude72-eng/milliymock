import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { SITE_THEME_TAG, readSiteTheme, writeSiteTheme } from "@/lib/server/site-settings";
import { THEME_IDS } from "@/lib/themes";

export const GET = route(async () => {
  await requireAdmin();
  return ok(await readSiteTheme());
});

const Body = z.object({ theme: z.enum(THEME_IDS) });

export const PUT = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { theme } = Body.parse(await readJson(req));
  const before = await readSiteTheme();
  if (before.theme !== theme) {
    await writeSiteTheme(theme, before.theme);
    // Next request re-renders with the new theme (no stale pages).
    revalidateTag(SITE_THEME_TAG, { expire: 0 });
  }
  return ok(await readSiteTheme());
});
