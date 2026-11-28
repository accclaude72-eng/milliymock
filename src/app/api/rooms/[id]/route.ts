import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { getRoom, leaveRoom, membership, ownerAction, postMessage, roomView } from "@/lib/server/rooms";
import { requireCandidate } from "@/lib/server/user-auth";

type Ctx = { params: Promise<{ id: string }> };

/** Room view + heartbeat. `?after=<message id>` returns only newer messages. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return ok(await roomView(user.uid, await getRoom((await params).id), Number.isFinite(after) && after > 0 ? Math.floor(after) : 0));
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("message"),
    body: z.string().trim().min(1, "Xabar bo‘sh").max(1000, "Xabar juda uzun"),
  }),
  z.object({ action: z.literal("leave") }),
  z.object({
    action: z.literal("timer"),
    mode: z.enum(["focus", "break", "stop"]),
  }),
  z.object({
    action: z.enum(["kick", "mute", "unmute"]),
    userId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("delete_message"),
    messageId: z.number().int().positive(),
  }),
]);

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const room = await getRoom((await params).id);
  const b = Body.parse(await readJson(req));
  if (b.action === "message") {
    if (!(await rateLimit(`roommsg:${user.uid}`, 20, 60_000))) throw new ApiError(429, "rate_limited", "Juda tez yozyapsiz. Bir oz kuting.");
    await postMessage(user.uid, room, b.body);
    return ok({ sent: true });
  }
  if (b.action === "leave") {
    await membership(user.uid, room.id);
    await leaveRoom(user.uid, room);
    return ok({ left: true });
  }
  if (b.action === "timer") await ownerAction(user.uid, room, { kind: "timer", mode: b.mode });
  else if (b.action === "delete_message")
    await ownerAction(user.uid, room, {
      kind: "delete_message",
      messageId: b.messageId,
    });
  else await ownerAction(user.uid, room, { kind: b.action, userId: b.userId });
  return ok({ done: true });
});
