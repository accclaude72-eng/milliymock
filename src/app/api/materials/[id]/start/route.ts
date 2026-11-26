import { startAttempt } from "@/lib/server/attempts";
import { ApiError, ok, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { profile } = await requireCandidate(req);
  if (!(await rateLimit(`start:${profile.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish boshlandi. Birozdan so‘ng qayta urinib ko‘ring.");
  return ok(await startAttempt(profile, id), 201);
});
