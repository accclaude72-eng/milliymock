import { z } from "zod";
import { gradeCard } from "@/lib/server/flashcards";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({ cardId: z.string().uuid(), grade: z.number().int().min(0).max(5) });

/** One flashcard review (SM-2 on the server). */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`review:${user.uid}`, 1500, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p takrorlash. Birozdan so‘ng davom eting.");
  const b = Body.parse(await readJson(req));
  return ok(await gradeCard(user.uid, b.cardId, b.grade));
});
