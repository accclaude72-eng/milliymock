import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { agentConfig, agentConfigured, listPending, listRuns, runAgentTask } from "@/lib/server/agent";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";

// The agent may run several tool rounds; give it time (Vercel caps this to the plan's limit).
export const maxDuration = 300;

export const GET = route(async () => {
  await requireAdmin();
  const [runs, pending] = await Promise.all([listRuns(), listPending()]);
  return ok({ config: agentConfig(), runs, pending });
});

const Body = z.object({ task: z.string().trim().min(3, "topshiriq juda qisqa").max(4000) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { task } = Body.parse(await readJson(req));
  if (!agentConfigured()) throw new ApiError(503, "agent_not_configured", "Agent ulanmagan: Vercel → Settings → Environment Variables ga BASE44_API_TOKEN qo‘shing.");
  if (!(await rateLimit("agent:task", 6, 60_000))) throw new ApiError(429, "rate_limited", "Bir daqiqada ko‘pi bilan 6 ta topshiriq. Birozdan so‘ng urinib ko‘ring.");
  return ok(await runAgentTask(task, new URL(req.url).origin));
});
