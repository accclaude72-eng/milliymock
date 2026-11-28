import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { createRoom, joinRoom, myRooms } from "@/lib/server/rooms";
import { requireCandidate } from "@/lib/server/user-auth";

export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  return ok({ rooms: await myRooms(user.uid) });
});

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(/^[^<>]*$/, "< va > belgilarisiz yozing");
const Body = z.union([
  z.object({
    action: z.literal("create"),
    name: text(3, 60),
    subjectCode: z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .nullable(),
    description: text(0, 300).nullable(),
    maxMembers: z.number().int().min(2).max(50),
  }),
  z.object({
    action: z.literal("join"),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, "Kod 8 ta harf/raqamdan iborat"),
  }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`rooms:${user.uid}`, 30, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
  const b = Body.parse(await readJson(req));
  if (b.action === "join") return ok({ id: await joinRoom(user.uid, b.code) });
  return ok({
    id: await createRoom(user.uid, {
      name: b.name,
      subjectCode: b.subjectCode,
      description: b.description || null,
      maxMembers: b.maxMembers,
    }),
  });
});
