import { z } from "zod";
import { heartbeat, playerView } from "@/lib/server/attempts";
import { ok, readJson, route } from "@/lib/server/http";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({ clientId: z.string().min(8).max(64), takeover: z.boolean().optional().default(false) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Body.parse(await readJson(req));
  const a = await heartbeat(id, user.uid, body.clientId, body.takeover);
  return ok({ view: playerView(a) });
});
