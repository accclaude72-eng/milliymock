import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { T, getDoc, upsertDoc } from "@/lib/server/supabase";
import { type ExamFormat, validateFormat } from "@/lib/formats";

const TaskType = z.enum(["Y1", "Y2", "O1", "O", "O2"]);
const Edit = z.object({
  label: z.string().trim().min(3).max(120),
  version: z.string().trim().min(1).max(20),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().trim().url().max(500).or(z.literal("")),
  sourceTitle: z.string().trim().max(200),
  totalTasks: z.number().int().min(1).max(200),
  totalMinutes: z.number().int().min(1).max(600),
  sections: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), title: z.string().trim().min(1).max(120), from: z.number().int(), to: z.number().int(), minutes: z.number().int().min(1).max(600) })).min(1).max(10),
  taskGroups: z.array(z.object({ type: TaskType, from: z.number().int(), to: z.number().int() })).min(1).max(20),
  y1OptionCount: z.number().int().min(2).max(10),
  y1OptionsByTask: z.record(z.string().regex(/^\d{1,3}$/), z.number().int().min(2).max(10)).optional(),
  y2Scoring: z.enum(["per_pair", "all_or_nothing"]),
  y2ScoringConfirmed: z.boolean(),
  o2Tasks: z.array(z.object({ number: z.number().int(), maxScore: z.number().min(0).max(200) })).max(20),
  topics: z.array(z.string().trim().min(1).max(200)).max(40),
  assessmentNote: z.string().trim().max(1000),
  status: z.enum(["active", "archived"]),
});

/**
 * Edits a format version. Safe for history: every material and attempt keeps its own
 * snapshot, so editing never changes already-created tests or completed results.
 */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const body = Edit.parse(await readJson(req));
  const before = await getDoc<ExamFormat>(T.formats, id);
  if (!before) throw new ApiError(404, "not_found", "Format topilmadi.");
  const next: ExamFormat = { ...before, ...body, id, updatedAt: Date.now() };
  const problems = validateFormat(next);
  if (problems.length) throw new ApiError(400, "invalid_format", problems.slice(0, 5).join(" "));
  await upsertDoc(T.formats, id, next);
  await audit("format.update", `formats/${id}`, {
    before: { totalTasks: before.totalTasks, totalMinutes: before.totalMinutes, o2: before.o2Tasks, y2Scoring: before.y2Scoring },
    after: { totalTasks: next.totalTasks, totalMinutes: next.totalMinutes, o2: next.o2Tasks, y2Scoring: next.y2Scoring },
  });
  return ok(next);
});
