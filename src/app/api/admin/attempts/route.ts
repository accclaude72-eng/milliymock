import { requireAdmin } from "@/lib/server/admin-session";
import { withAttempt } from "@/lib/server/attempts";
import { db } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";
import { currentDeadline } from "@/lib/timing";
import type { Attempt } from "@/lib/types";

export const GET = route(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const subject = url.searchParams.get("subject");
  const materialId = url.searchParams.get("materialId");
  const snap = await db().collection(COL.attempts).orderBy("createdAt", "desc").limit(1000).get();
  let list = snap.docs.map((d) => d.data() as Attempt);

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
