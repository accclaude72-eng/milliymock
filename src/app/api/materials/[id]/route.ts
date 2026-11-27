import { ApiError, ok, route } from "@/lib/server/http";
import { paymentOf } from "@/lib/server/payments";
import { attemptsOf, getMaterial, toPublicMaterial } from "@/lib/server/repo";
import { readPaymentSettings } from "@/lib/server/site-settings";
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
  const price = m.price && m.price > 0 ? m.price : null;
  const [pay, card] = price ? await Promise.all([paymentOf(profile.uid, id), readPaymentSettings()]) : [null, null];
  return ok({
    payment: price
      ? {
          price,
          status: pay?.status ?? null,
          note: pay?.note ?? "",
          requestedAt: pay?.requestedAt ?? null,
          card: card && card.cardNumber ? { number: card.cardNumber, holder: card.cardHolder, instructions: card.instructions } : null,
        }
      : null,
    material: toPublicMaterial(m),
    ready: !!m.html && m.keyStatus.complete,
    candidateId: profile.candidateId,
    candidateName: `${profile.firstName} ${profile.lastName}`,
    inProgressAttemptId: inProgress?.id ?? null,
    finishedAttempts: finished,
  });
});
