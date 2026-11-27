import { withAttempt } from "@/lib/server/attempts";
import { ApiError, ok, route } from "@/lib/server/http";
import { getKey } from "@/lib/server/repo";
import { candidateResult } from "@/lib/server/results";
import { T, getDoc } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";
import type { Material } from "@/lib/types";

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const a = await withAttempt(id, user.uid, () => ({}));
  if (a.status === "in_progress") throw new ApiError(409, "in_progress", "Imtihon hali yakunlanmagan.");
  const material = await getDoc<Material>(T.materials, a.materialId);
  // The key is only read (server-side) after publication; answers only when disclosure is allowed.
  let key = null;
  if (a.status === "published") {
    const items = (await getKey(a.materialId))?.items ?? {};
    key = material?.revealAnswers ? items : Object.fromEntries(Object.entries(items).filter(([, v]) => v.type === "O2"));
  }
  return ok(candidateResult(a, material, key));
});
