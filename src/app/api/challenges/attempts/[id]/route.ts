import { z } from "zod";
import { type AttemptRow, attemptView, finish, getChallenge, saveAnswers } from "@/lib/server/challenges";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { bankRows } from "@/lib/server/question-bank";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";
import { DISPLAY } from "@/lib/gamify";

type Ctx = { params: Promise<{ id: string }> };

async function own(uid: string, id: string): Promise<AttemptRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Urinish topilmadi.");
  const a = must(await sb().from("challenge_attempts").select("*").eq("id", id).eq("user_id", uid).maybeSingle(), "attempt") as AttemptRow | null;
  if (!a) throw new ApiError(404, "not_found", "Urinish topilmadi.");
  return a;
}

/** The attempt as this student sees it. After it ends: own answers + correct options. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  let a = await own(user.uid, (await params).id);
  const c = await getChallenge(a.challenge_id);
  // Time ran out while away → the server finishes it with the answers saved in time.
  if (a.status === "in_progress" && Date.parse(a.deadline_at) + 15_000 < Date.now()) {
    await finish(user.uid, c, a, a.answers ?? {}, true).catch(() => undefined);
    a = await own(user.uid, a.id);
  }
  const questions = await attemptView(a);
  let review: Record<string, { correct: string | null }> | null = null;
  if (a.status !== "in_progress") {
    const bank = await bankRows(a.layout.order);
    review = Object.fromEntries(
      a.layout.order.map((qid) => {
        const idx = (a.layout.options[qid] ?? []).indexOf(bank.get(qid)?.correct ?? "");
        return [qid, { correct: idx >= 0 ? DISPLAY[idx] : null }];
      }),
    );
  }
  return ok({
    id: a.id,
    challenge: { id: c.id, title: c.title, subjectCode: c.subject_code, timeLimitSec: c.time_limit_sec, xp: c.xp_base },
    status: a.status,
    deadline: Date.parse(a.deadline_at),
    serverNow: Date.now(),
    answers: a.answers ?? {},
    questions,
    result: a.status === "in_progress" ? null : { correct: a.correct, total: a.total, percent: Number(a.percent), durationMs: a.duration_ms },
    review,
  });
});

const Body = z.object({
  action: z.enum(["save", "submit"]),
  answers: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,64}:\d{1,3}$/), z.string().regex(/^[A-J]$/)),
});

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const a = await own(user.uid, (await params).id);
  const { action, answers } = Body.parse(await readJson(req));
  // Only answers to this attempt's questions are kept.
  const clean = Object.fromEntries(Object.entries(answers).filter(([q]) => a.layout.order.includes(q)));
  if (action === "save") {
    await saveAnswers(a, clean);
    return ok({ saved: true });
  }
  const c = await getChallenge(a.challenge_id);
  return ok(await finish(user.uid, c, a, clean));
});
