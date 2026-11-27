import { ApiError, ok, route } from "@/lib/server/http";
import { attemptsOf, getMaterial, toPublicMaterial } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

/** Pre-exam instructions data. Never includes the answer key. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { profile } = await requireCandidate(req);
  const m = await getMaterial(id).catch(() => null);
  if (!m || m.status !== "published") throw new ApiError(404, "material_not_found", "Test topilmadi yoki hali e’lon qilinmagan.");
  const mine = await attemptsOf({ uid: profile.uid, materialId: id });
  const inProgress = mine.find((a) => a.status === "in_progress");
  const finished = mine.filter((a) => a.status !== "in_progress").length;
  return ok({
    material: toPublicMaterial(m),
    ready: !!m.html && m.keyStatus.complete,
    candidateId: profile.candidateId,
    candidateName: `${profile.firstName} ${profile.lastName}`,
    inProgressAttemptId: inProgress?.id ?? null,
    finishedAttempts: finished,
  });
});
