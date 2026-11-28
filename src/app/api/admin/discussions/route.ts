import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { adminRecent, adminReports, dismissReport, setPostStatus } from "@/lib/server/discussions";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";

/** Moderation: reports (open first) and the latest posts. */
export const GET = route(async (req) => {
  await requireAdmin();
  const all = new URL(req.url).searchParams.get("reports") === "all";
  const [reports, recent] = await Promise.all([adminReports(all ? "all" : "open"), adminRecent()]);
  return ok({ reports, recent });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["hide", "restore"]), type: z.enum(["thread", "reply"]), id: z.string().uuid() }),
  z.object({ action: z.literal("dismiss"), reportId: z.string().uuid() }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Body.parse(await readJson(req));
  if (b.action === "dismiss") {
    await dismissReport(b.reportId);
    await audit("discussion.report_dismissed", `reports/${b.reportId}`, {});
  } else {
    await setPostStatus(b.type, b.id, b.action === "hide" ? "hidden" : "visible");
    await audit(`discussion.${b.action === "hide" ? "hidden" : "restored"}`, `${b.type}s/${b.id}`, {});
  }
  return ok({ done: true });
});
