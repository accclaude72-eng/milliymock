import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

const Body = z.object({ status: z.enum(["published", "archived"]) });

/** Hide (archive) or re-publish a challenge. Attempts and XP already earned are kept. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Topilmadi.");
  const { status } = Body.parse(await readJson(req));
  const r = must(await sb().from("daily_challenges").update({ status }).eq("id", id).select("id").maybeSingle(), "challenge status");
  if (!r) throw new ApiError(404, "not_found", "Topilmadi.");
  await audit(`challenge.${status}`, `challenges/${id}`, {});
  return ok({ id, status });
});
