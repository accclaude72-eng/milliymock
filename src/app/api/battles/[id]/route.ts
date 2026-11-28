import { z } from "zod";
import { answer, battleView, cancelBattle, getBattle, joinBattle } from "@/lib/server/battles";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { requireCandidate } from "@/lib/server/user-auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  return ok(await battleView(user.uid, await getBattle((await params).id)));
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answer"),
    position: z.number().int().min(0).max(19),
    letter: z
      .string()
      .regex(/^[A-J]$/)
      .nullable(),
  }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("join") }),
]);

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const id = (await params).id;
  const b = Body.parse(await readJson(req));
  if (b.action === "join") return ok({ id: await joinBattle(user.uid, { id }) });
  const battle = await getBattle(id);
  if (b.action === "cancel") {
    await cancelBattle(user.uid, battle);
    return ok({ cancelled: true });
  }
  return ok(await answer(user.uid, battle, b.position, b.letter));
});
