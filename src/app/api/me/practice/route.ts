import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { checkPractice, ingestAttempts, newSessionId } from "@/lib/server/mistakes";
import { type BankRow, bankRows, revealMap, toPublicQuestion } from "@/lib/server/question-bank";
import { rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Practice set. mode=mistakes → the student's own unresolved mistakes (most overdue first);
 * mode=bank → questions from published tests that allow showing answers.
 * Never includes correct answers — those are checked by POST.
 */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "bank" ? "bank" : "mistakes";
  const subject = url.searchParams.get("subject") || null;
  const topic = url.searchParams.get("topic") || null;
  const count = Math.min(50, Math.max(1, Number(url.searchParams.get("count")) || 10));

  let rows: BankRow[];
  if (mode === "mistakes") {
    await ingestAttempts(user.uid);
    let q = sb().from("student_mistakes").select("question_id").eq("user_id", user.uid).neq("status", "resolved");
    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);
    if (ids.length) q = q.in("id", ids);
    if (subject) q = q.eq("subject_code", subject);
    if (topic) q = q.eq("topic", topic);
    if (url.searchParams.get("due") === "1") q = q.lte("next_review_at", new Date().toISOString());
    const ms = must(await q.order("next_review_at", { ascending: true }).limit(count), "practice mistakes") ?? [];
    const bank = await bankRows(ms.map((m) => m.question_id as string));
    rows = ms.flatMap((m) => bank.get(m.question_id as string) ?? []);
  } else {
    let q = sb().from("question_bank").select("*").eq("active", true);
    if (subject) q = q.eq("subject_code", subject);
    if (topic) q = q.eq("topic", topic);
    const all = (must(await q.limit(500), "practice bank") ?? []) as BankRow[];
    const reveal = await revealMap(all.map((r) => r.material_id));
    rows = shuffle(all.filter((r) => reveal.get(r.material_id)?.reveal)).slice(0, count);
  }
  return ok({ sessionId: newSessionId(), mode, questions: rows.map(toPublicQuestion) });
});

const Check = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}:\d{1,3}$/),
  answer: z.string().trim().min(1).max(100),
});

/** Server-side check: updates the mistake notebook; reveals the answer only if the test allows it. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`practice:${user.uid}`, 300, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p javob. Birozdan so‘ng davom eting.");
  const b = Check.parse(await readJson(req));
  const row = (await bankRows([b.questionId])).get(b.questionId);
  if (!row) throw new ApiError(404, "not_found", "Savol topilmadi.");
  const reveal = (await revealMap([row.material_id])).get(row.material_id);
  if (!reveal) throw new ApiError(404, "not_found", "Savol topilmadi.");
  // A hidden-answer test question may be practised only if it is already one of the student's own mistakes.
  if (!reveal.reveal || !row.active) {
    const mine = must(await sb().from("student_mistakes").select("id").eq("user_id", user.uid).eq("question_id", row.id).maybeSingle(), "own mistake");
    if (!mine) throw new ApiError(403, "forbidden", "Bu savol mashq uchun ochiq emas.");
  }
  const correct = await checkPractice(user.uid, row, b.answer, b.sessionId);
  return ok({ correct, correctAnswer: reveal.reveal ? row.correct : null, explanation: reveal.reveal ? row.explanation : null });
});
