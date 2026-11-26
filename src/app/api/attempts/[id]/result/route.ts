import { withAttempt } from "@/lib/server/attempts";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";
import { candidateResult } from "@/lib/server/results";
import { requireCandidate } from "@/lib/server/user-auth";
import type { Material, MaterialKeyDoc } from "@/lib/types";

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const a = await withAttempt(id, user.uid, () => ({}));
  if (a.status === "in_progress") throw new ApiError(409, "in_progress", "Imtihon hali yakunlanmagan.");
  const mat = await db().collection(COL.materials).doc(a.materialId).get();
  const material = mat.exists ? (mat.data() as Material) : null;
  // The key is only read (server-side) when disclosure is actually allowed.
  let key = null;
  if (a.status === "published" && material?.revealAnswers) {
    const k = await db().collection(COL.materialKeys).doc(a.materialId).get();
    key = k.exists ? (k.data() as MaterialKeyDoc).items : null;
  } else if (a.status === "published") {
    // Rubric criteria labels (not answers) are still shown for published O2 scores.
    const k = await db().collection(COL.materialKeys).doc(a.materialId).get();
    const items = k.exists ? (k.data() as MaterialKeyDoc).items : {};
    key = Object.fromEntries(Object.entries(items).filter(([, v]) => v.type === "O2"));
  }
  return ok(candidateResult(a, material, key));
});
