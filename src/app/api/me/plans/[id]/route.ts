import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { PlanSettings, type PlanRow, regenerate, subjectTopics, todayUz } from "@/lib/server/plans";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({
  action: z.enum(["update", "pause", "resume", "regenerate", "archive"]),
  settings: PlanSettings.optional(),
});

/** Edit / pause / resume / regenerate / archive the student's own plan. Finished tasks are always kept. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Reja topilmadi.");
  const { action, settings } = Body.parse(await readJson(req));
  const cur = must(await sb().from("study_plans").select("*").eq("id", id).eq("user_id", user.uid).maybeSingle(), "plan") as PlanRow | null;
  if (!cur || cur.status === "archived") throw new ApiError(404, "not_found", "Reja topilmadi.");

  const patch: Partial<PlanRow> = { updated_at: new Date().toISOString() };
  if (action === "update") {
    if (!settings) throw new ApiError(400, "invalid_input", "Sozlamalar yuborilmadi.");
    if (settings.examDate <= todayUz()) throw new ApiError(400, "bad_date", "Imtihon sanasi bugundan keyin bo‘lishi kerak.");
    const { topics } = await subjectTopics(cur.subject_code);
    Object.assign(patch, {
      exam_date: settings.examDate,
      target_score: settings.targetScore,
      current_estimate: settings.currentEstimate,
      daily_minutes: settings.dailyMinutes,
      study_days: [...new Set(settings.studyDays)].sort(),
      priority_topics: settings.priorityTopics.filter((t) => topics.includes(t)),
    });
  }
  if (action === "pause") patch.status = "paused";
  if (action === "resume") patch.status = "active";
  if (action === "archive") patch.status = "archived";

  const next = must(await sb().from("study_plans").update(patch).eq("id", id).eq("user_id", user.uid).select("*").single(), "plan update") as PlanRow;
  // Pausing clears future to-dos; resuming / editing / regenerating rebuilds them from today.
  const tasks = action === "archive" ? 0 : await regenerate(next);
  return ok({ id, status: next.status, tasks });
});
