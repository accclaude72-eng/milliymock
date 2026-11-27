import { requireAdmin } from "@/lib/server/admin-session";
import { withAttempt } from "@/lib/server/attempts";
import { ok, route } from "@/lib/server/http";
import { T, must, sb } from "@/lib/server/supabase";
import { currentDeadline } from "@/lib/timing";
import type { Attempt } from "@/lib/types";

export const GET = route(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const subject = url.searchParams.get("subject");
  const materialId = url.searchParams.get("materialId");
  let list = (must(await sb().from(T.attempts).select("doc").order("created_ms", { ascending: false }).limit(1000), "attempts") ?? []).map((r) => r.doc as Attempt);

  const now = Date.now();
  const expired = list.filter((a) => a.status === "in_progress" && (currentDeadline(a.timing) ?? Infinity) <= now);
  if (expired.length) {
    const upd = await Promise.all(expired.map((a) => withAttempt(a.id, null, () => ({}))));
    const m = new Map(upd.map((a) => [a.id, a]));
    list = list.map((a) => m.get(a.id) ?? a);
  }
  if (status) list = list.filter((a) => a.status === status);
  if (subject) list = list.filter((a) => a.subjectCode === subject);
  if (materialId) list = list.filter((a) => a.materialId === materialId);

  return ok(
    list.map((a) => ({
      id: a.id,
      uid: a.uid,
      candidateId: a.candidateId,
      candidateName: a.candidateName,
      materialId: a.materialId,
      materialTitle: a.materialTitle,
      subjectCode: a.subjectCode,
      subjectName: a.subjectName,
      status: a.status,
      createdAt: a.createdAt,
      submittedAt: a.submittedAt,
      percent: a.grading?.summary.percent ?? null,
      score: a.grading?.summary.score ?? null,
      max: a.grading?.summary.max ?? null,
      needsReview: a.grading?.summary.needsReview ?? 0,
      hasO2: a.hasO2,
      o2Reviewed: Object.keys(a.o2Reviews ?? {}).length,
      o2Count: a.format.o2Tasks.length,
    })),
  );
});
