import { startAttempt } from "@/lib/server/attempts";
import { ApiError, ok, route } from "@/lib/server/http";
import { paymentOf } from "@/lib/server/payments";
import { getMaterial, rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { profile } = await requireCandidate(req);
  if (!(await rateLimit(`start:${profile.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish boshlandi. Birozdan so‘ng qayta urinib ko‘ring.");
  // Paid tests open only after the admin (or the agent) has approved the candidate's payment.
  const m = await getMaterial(id).catch(() => null);
  if (m?.price && m.price > 0 && (await paymentOf(profile.uid, id))?.status !== "approved") {
    throw new ApiError(402, "payment_required", "Bu pullik test. To‘lov tasdiqlangandan so‘ng boshlashingiz mumkin.");
  }
  return ok(await startAttempt(profile, id), 201);
});
