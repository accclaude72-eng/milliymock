import { z } from "zod";
import { playerView, saveAnswers } from "@/lib/server/attempts";
import { ok, readJson, route } from "@/lib/server/http";
import { requireCandidate } from "@/lib/server/user-auth";

const AnswerSchema = z.union([z.string().max(20_000), z.array(z.string().max(4)).max(26), z.object({ text: z.string().max(20_000) }), z.null()]);
const Body = z.object({
  clientId: z.string().min(8).max(64),
  changes: z.record(z.string().regex(/^\d{1,3}$/), AnswerSchema),
  takeover: z.boolean().optional().default(false),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Body.parse(await readJson(req));
  const { attempt, result } = await saveAnswers(id, user.uid, body.clientId, body.changes, body.takeover);
  return ok({ view: playerView(attempt), result });
});
