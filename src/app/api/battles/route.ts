import { z } from "zod";
import { createBattle, joinBattle, myBattles } from "@/lib/server/battles";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

/** My battle record, history and friend invitations. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  return ok(await myBattles(user.uid));
});

const Body = z.union([
  z.object({
    action: z.literal("create"),
    mode: z.enum(["random", "code", "friend"]),
    subject: z.string().regex(/^[a-z0-9-]{1,40}$/),
    friendId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("join"),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{6}$/, "Kod 6 ta harf/raqamdan iborat"),
  }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`battle:${user.uid}`, 40, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p battle. Birozdan so‘ng urinib ko‘ring.");
  const b = Body.parse(await readJson(req));
  if (b.action === "join") return ok({ id: await joinBattle(user.uid, { code: b.code }) });
  return ok(
    await createBattle(user.uid, {
      mode: b.mode,
      subject: b.subject,
      friendId: b.friendId,
    }),
  );
});
