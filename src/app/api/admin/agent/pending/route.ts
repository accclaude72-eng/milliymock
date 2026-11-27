import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { resolvePending } from "@/lib/server/agent";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";

const Body = z.object({ id: z.string().regex(/^[0-9a-f]{12}$/), decision: z.enum(["confirm", "decline"]) });

/** Admin confirms / declines a destructive or money-related action the agent asked for. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id, decision } = Body.parse(await readJson(req));
  return ok(await resolvePending(id, decision, new URL(req.url).origin));
});
