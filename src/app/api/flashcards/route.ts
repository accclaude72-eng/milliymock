import { z } from "zod";
import { createDeck, listDecks } from "@/lib/server/flashcards";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

/** The student's decks (own, "Xatolarim", official) with due / new counts. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  return ok({ decks: await listDecks(user.uid) });
});

const Body = z.object({
  title: z.string().trim().min(3, "Nomi kamida 3 ta belgi").max(80),
  description: z.string().trim().max(300).nullable().default(null),
  subjectCode: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable()
    .default(null),
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`decks:${user.uid}`, 30, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
  const b = Body.parse(await readJson(req));
  return ok({ id: await createDeck(user.uid, { title: b.title, description: b.description || null, subjectCode: b.subjectCode }) }, 201);
});
