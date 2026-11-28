import { z } from "zod";
import { discussionView, editOwn, postReply, postThread, removeOwn, report, toggleVote } from "@/lib/server/discussions";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";

type Ctx = { params: Promise<{ questionId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  return ok(await discussionView(user.uid, decodeURIComponent((await params).questionId)));
});

const body = z.string().trim().min(2, "Xabar juda qisqa").max(2000, "Xabar juda uzun");
const target = z.enum(["thread", "reply"]);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("thread"), body }),
  z.object({ action: z.literal("reply"), threadId: z.string().uuid(), body }),
  z.object({ action: z.literal("edit"), type: target, id: z.string().uuid(), body }),
  z.object({ action: z.literal("remove"), type: target, id: z.string().uuid() }),
  z.object({ action: z.literal("vote"), type: target, id: z.string().uuid() }),
  z.object({
    action: z.literal("report"),
    type: target,
    id: z.string().uuid(),
    reason: z.enum(["spam", "abuse", "wrong", "spoiler", "other"]),
    note: z.string().trim().max(300).nullable().default(null),
  }),
]);

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const qid = decodeURIComponent((await params).questionId);
  const b = Body.parse(await readJson(req));
  if (b.action === "thread" || b.action === "reply") {
    if (!(await rateLimit(`discuss:${user.uid}`, 30, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p xabar. Birozdan so‘ng yozing.");
    return ok({ id: b.action === "thread" ? await postThread(user.uid, qid, b.body) : await postReply(user.uid, b.threadId, b.body) }, 201);
  }
  if (b.action === "edit") await editOwn(user.uid, b.type, b.id, b.body);
  else if (b.action === "remove") await removeOwn(user.uid, b.type, b.id);
  else if (b.action === "vote") return ok({ voted: await toggleVote(user.uid, b.type, b.id) });
  else {
    if (!(await rateLimit(`report:${user.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p shikoyat. Birozdan so‘ng urinib ko‘ring.");
    await report(user.uid, b.type, b.id, b.reason, b.note || null);
  }
  return ok({ done: true });
});
