import { db } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";
import { COL, toPublicMaterial } from "@/lib/server/repo";
import type { Material } from "@/lib/types";

/** Public catalog of published mock variants (no answer keys). */
export const GET = route(async () => {
  const snap = await db().collection(COL.materials).where("status", "==", "published").get();
  return ok(
    snap.docs
      .map((d) => d.data() as Material)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .map(toPublicMaterial),
  );
});
