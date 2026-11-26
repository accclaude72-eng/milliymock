import { z } from "zod";
import { advanceSection, playerView } from "@/lib/server/attempts";
import { ok, readJson, route } from "@/lib/server/http";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({ clientId: z.string().min(8).max(64), fromIndex: z.number().int().min(0).max(20) });

/** Candidate closes the current section early (idempotent). */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Body.parse(await readJson(req));
  const a = await advanceSection(id, user.uid, body.clientId, body.fromIndex);
  return ok({ view: playerView(a) });
});
