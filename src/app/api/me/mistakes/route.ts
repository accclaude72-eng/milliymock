import { ok, route } from "@/lib/server/http";
import { ingestAttempts } from "@/lib/server/mistakes";
import { type BankRow, toPublicQuestion } from "@/lib/server/question-bank";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** The student's mistake notebook + statistics. Pulls in mistakes from newly published results first. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  await ingestAttempts(user.uid);
  // One round trip: mistake + its bank question + the test's title and answer-visibility flag.
  const rows =
    must(
      await sb()
        .from("student_mistakes")
        .select("*, question_bank(*, materials(id, title:doc->>title, reveal:doc->revealAnswers))")
        .eq("user_id", user.uid)
        .order("last_wrong_at", { ascending: false })
        .limit(1000),
      "mistakes",
    ) ?? [];
  const now = Date.now();
  const items = rows.flatMap((r) => {
    const b = r.question_bank as (BankRow & { materials: { title: string | null; reveal: boolean | null } | null }) | null;
    if (!b) return [];
    const m = b.materials ? { title: b.materials.title ?? "", reveal: b.materials.reveal === true } : null;
    return [
      {
        id: r.id as number,
        question: toPublicQuestion(b),
        materialTitle: m?.title ?? "",
        correctAnswer: m?.reveal ? b.correct : null,
        explanation: m?.reveal ? b.explanation : null,
        lastAnswer: r.last_answer as string | null,
        wrongCount: r.wrong_count as number,
        correctStreak: r.correct_streak as number,
        status: r.status as "open" | "understood" | "resolved",
        bookmarked: r.bookmarked as boolean,
        note: (r.note as string | null) ?? "",
        reviewStage: r.review_stage as number,
        nextReviewAt: Date.parse(r.next_review_at),
        due: r.status !== "resolved" && Date.parse(r.next_review_at) <= now,
        lastWrongAt: Date.parse(r.last_wrong_at),
      },
    ];
  });

  // Statistics from the same real rows.
  const bySubject: Record<string, { total: number; open: number }> = {};
  for (const i of items) {
    const s = (bySubject[i.question.subjectCode] ??= { total: 0, open: 0 });
    s.total++;
    if (i.status !== "resolved") s.open++;
  }
  const stats = {
    total: items.length,
    resolved: items.filter((i) => i.status === "resolved").length,
    understood: items.filter((i) => i.status === "understood").length,
    open: items.filter((i) => i.status === "open").length,
    due: items.filter((i) => i.due).length,
    bySubject,
    mostRepeated: [...items]
      .filter((i) => i.wrongCount > 1)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 5)
      .map((i) => i.id),
  };
  return ok({ items, stats });
});
