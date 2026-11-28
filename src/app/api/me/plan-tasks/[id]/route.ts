import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({ status: z.enum(["todo", "done", "skipped"]) });

/** Tick off / undo / skip one of the student's own tasks. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, "not_found", "Vazifa topilmadi.");
  const { status } = Body.parse(await readJson(req));
  const row = must(
    await sb()
      .from("study_plan_tasks")
      .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("user_id", user.uid)
      .select("id, status, done_at")
      .maybeSingle(),
    "task update",
  );
  if (!row) throw new ApiError(404, "not_found", "Vazifa topilmadi.");
  return ok(row);
});
