import { type AttemptPoint, computeAnalytics } from "@/lib/analytics";
import { ok, route } from "@/lib/server/http";
import { attemptsOf } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";
import { timeSpentMs } from "@/lib/timing";

/** Analytics from the student's own published results and practice answers (real data only). */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const all = await attemptsOf({ uid: user.uid });
  const points: AttemptPoint[] = all
    .filter((a) => a.status === "published" && a.grading)
    .map((a) => {
      const s = a.grading!.summary;
      const auto = a.grading!.questions.filter((q) => q.type !== "O2");
      return {
        id: a.id,
        subjectCode: a.subjectCode,
        subjectName: a.subjectName,
        title: a.materialTitle,
        at: a.submittedAt ?? a.createdAt,
        percent: s.percent,
        correct: s.correct,
        incorrect: s.incorrect + s.partial,
        unanswered: s.unanswered,
        questions: auto.length,
        durationMs: timeSpentMs(a.timing, a.submittedAt ?? Date.now()),
        byTopic: Object.fromEntries(Object.entries(s.byTopic).map(([t, b]) => [t, { correct: b.correct, count: b.count }])),
      };
    });
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const practice = (
    must(await sb().from("answer_events").select("at, correct, source").eq("user_id", user.uid).like("source", "practice:%").gte("at", since).limit(5000), "practice events") ?? []
  ).map((e) => ({ at: Date.parse(e.at), correct: !!e.correct }));
  return ok({
    ...computeAnalytics(points, practice, Date.now()),
    pendingReview: all.filter((a) => a.status === "pending_review" || a.status === "graded").length,
  });
});
