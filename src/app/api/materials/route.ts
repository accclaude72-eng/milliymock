import { ok, route } from "@/lib/server/http";
import { toPublicMaterial } from "@/lib/server/repo";
import { T, must, sb } from "@/lib/server/supabase";
import type { Material } from "@/lib/types";

/** Public catalog of published mock variants (no answer keys). */
export const GET = route(async () => {
  const rows = must(await sb().from(T.materials).select("doc").eq("status", "published").order("published_ms", { ascending: false }), "catalog");
  return ok((rows ?? []).map((r) => toPublicMaterial(r.doc as Material)));
});
