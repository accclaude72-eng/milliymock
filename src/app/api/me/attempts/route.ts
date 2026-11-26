import { withAttempt } from "@/lib/server/attempts";
import { db } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";
import { requireCandidate } from "@/lib/server/user-auth";
import { currentDeadline, timeSpentMs } from "@/lib/timing";
import type { Attempt } from "@/lib/types";

export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const snap = await db().collection(COL.attempts).where("uid", "==", user.uid).get();
  let attempts = snap.docs.map((d) => d.data() as Attempt);

  // Lazily finalize attempts whose server-side time has already run out.
  const now = Date.now();
  const expired = attempts.filter((a) => {
    if (a.status !== "in_progress") return false;
    const d = currentDeadline(a.timing);
    return d !== null && d <= now;
  });
  if (expired.length) {
    const updated = await Promise.all(expired.map((a) => withAttempt(a.id, user.uid, () => ({}))));
    const map = new Map(updated.map((a) => [a.id, a]));
    attempts = attempts.map((a) => map.get(a.id) ?? a);
  }

  attempts.sort((a, b) => b.createdAt - a.createdAt);
  return ok(
    attempts.map((a) => {
      const published = a.status === "published";
      const o2Total = published ? Object.values(a.o2Reviews ?? {}).reduce((s, r) => s + r.total, 0) : null;
      return {
        id: a.id,
        materialId: a.materialId,
        materialTitle: a.materialTitle,
        subjectCode: a.subjectCode,
        subjectName: a.subjectName,
        mode: a.mode,
        status: a.status,
        createdAt: a.createdAt,
        submittedAt: a.submittedAt,
        deadline: a.status === "in_progress" ? currentDeadline(a.timing) : null,
        timeSpentMs: timeSpentMs(a.timing, a.submittedAt ?? now),
        totalTasks: a.format.totalTasks,
        summary: a.grading?.summary ?? null,
        hasO2: a.hasO2,
        o2Total,
        o2Max: a.format.o2Tasks.reduce((s, t) => s + t.maxScore, 0),
      };
    }),
  );
});
