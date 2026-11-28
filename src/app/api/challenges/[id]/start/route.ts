import { getChallenge, startAttempt } from "@/lib/server/challenges";
import { ApiError, assertSameOrigin, ok, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`challenge:${user.uid}`, 30, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
  const c = await getChallenge((await params).id);
  const a = await startAttempt(user.uid, c);
  return ok({ attemptId: a.id }, 201);
});
