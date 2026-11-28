import "server-only";
import { randomUUID } from "node:crypto";
import type { AnswerValue } from "@/lib/grading";
import { type MistakeState, afterCorrect, afterWrong } from "@/lib/srs";
import type { Attempt } from "@/lib/types";
import { type BankRow, bankRows, ensureBank, gradeBankAnswer } from "./question-bank";
import { attemptsOf } from "./repo";
import { must, sb } from "./supabase";

/*
 * Mistake notebook. Fed only by real graded answers:
 *  - published mock attempts (ingested lazily and idempotently: answer_events PK = (source, question)),
 *  - practice / review answers checked on the server.
 */
interface MistakeRow extends MistakeState {
  id: number;
  user_id: string;
  question_id: string;
  subject_code: string;
  topic: string | null;
  last_answer: string | null;
  bookmarked: boolean;
  note: string | null;
  first_seen_at: string;
  last_wrong_at: string;
  last_reviewed_at: string | null;
}

const answerText = (v: AnswerValue | undefined): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v.slice(0, 200);
  if (Array.isArray(v)) return v.join(",").slice(0, 200);
  return v.text.slice(0, 200);
};

/** Applies one graded answer to the notebook (insert / update the student's mistake row). */
async function applyOutcome(uid: string, row: BankRow, correct: boolean, answer: string | null, at: number): Promise<void> {
  const existing = must(await sb().from("student_mistakes").select("*").eq("user_id", uid).eq("question_id", row.id).maybeSingle(), "mistake get") as MistakeRow | null;
  const iso = new Date(at).toISOString();
  if (!correct) {
    const next = afterWrong(existing, at);
    must(
      await sb()
        .from("student_mistakes")
        .upsert(
          { user_id: uid, question_id: row.id, subject_code: row.subject_code, topic: row.topic, last_answer: answer, ...next, last_wrong_at: iso, last_reviewed_at: existing ? iso : null, updated_at: iso },
          { onConflict: "user_id,question_id" },
        ),
      "mistake wrong",
    );
  } else if (existing && existing.status !== "resolved") {
    const next = afterCorrect(existing, at);
    must(await sb().from("student_mistakes").update({ ...next, last_answer: answer, last_reviewed_at: iso, updated_at: iso }).eq("id", existing.id), "mistake right");
  }
}

/** Records a graded answer once per source. Returns false if this source already counted it. */
async function recordEvent(source: string, uid: string, questionId: string, correct: boolean, answer: string | null, at: number): Promise<boolean> {
  const { data, error } = await sb()
    .from("answer_events")
    .upsert({ source, question_id: questionId, user_id: uid, correct, answer, at: new Date(at).toISOString() }, { onConflict: "source,question_id", ignoreDuplicates: true })
    .select("source");
  must({ data, error }, "answer event");
  return (data?.length ?? 0) > 0;
}

/** Pulls mistakes from every published attempt of the student not yet ingested. Cheap when nothing is new. */
export async function ingestAttempts(uid: string): Promise<number> {
  // Cheap check first (ids only, two queries in parallel); full attempt documents only when something is new.
  const [pubRes, doneRes] = await Promise.all([
    sb().from("attempts").select("id").eq("user_id", uid).eq("status", "published"),
    sb().from("answer_events").select("source").eq("user_id", uid).like("source", "attempt:%"),
  ]);
  const publishedIds = (must(pubRes, "published ids") ?? []).map((r) => r.id as string);
  const done = new Set((must(doneRes, "ingested") ?? []).map((r) => r.source as string));
  const newIds = new Set(publishedIds.filter((id) => !done.has(`attempt:${id}`)));
  if (!newIds.size) return 0;
  const todo = (await attemptsOf({ uid })).filter((a) => newIds.has(a.id) && a.grading).sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0));
  if (!todo.length) return 0;
  await ensureBank(todo.map((a) => a.materialId));
  let count = 0;
  for (const a of todo) count += await ingestOne(uid, a);
  return count;
}

async function ingestOne(uid: string, a: Attempt): Promise<number> {
  const results = (a.grading?.questions ?? []).filter((q) => (q.type === "Y1" || q.type === "O1" || q.type === "O") && ["correct", "incorrect", "unanswered"].includes(q.status));
  const rows = await bankRows(results.map((q) => `${a.materialId}:${q.n}`));
  const at = a.submittedAt ?? a.publishedAt ?? Date.now();
  let n = 0;
  for (const q of results) {
    const row = rows.get(`${a.materialId}:${q.n}`);
    if (!row) continue;
    const correct = q.status === "correct";
    const answer = answerText(a.answers[String(q.n)]);
    if (await recordEvent(`attempt:${a.id}`, uid, row.id, correct, answer, at)) {
      await applyOutcome(uid, row, correct, answer, at);
      if (!correct) n++;
    }
  }
  return n;
}

/** Server-side check of a practice / review answer. Updates the notebook. */
export async function checkPractice(uid: string, row: BankRow, answer: string, sessionId: string): Promise<boolean> {
  const correct = await gradeBankAnswer(row, answer);
  const now = Date.now();
  const source = `practice:${sessionId}`;
  // One counted answer per question per session — re-submitting can't farm progress.
  if (await recordEvent(source, uid, row.id, correct, answer.slice(0, 200), now)) await applyOutcome(uid, row, correct, answer.slice(0, 200), now);
  return correct;
}

export const newSessionId = () => randomUUID();
