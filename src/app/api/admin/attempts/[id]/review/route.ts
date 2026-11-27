import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { updateAttempt } from "@/lib/server/attempts";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit, getKey } from "@/lib/server/repo";
import { taskTypeOf } from "@/lib/formats";
import { type KeyO2, type QuestionResult, summarize, totalO2 } from "@/lib/grading";
import type { Attempt, AttemptStatus, O2ReviewRecord } from "@/lib/types";

const O2Review = z.object({
  m: z.number().min(0).max(100).default(0),
  a: z.number().min(0).max(100).default(0),
  criteria: z.array(z.object({ id: z.string().max(40), score: z.number().min(0).max(100), comment: z.string().max(1000).optional() })).max(30).default([]),
  comment: z.string().max(4000).optional().default(""),
  errorTags: z.array(z.string().max(60)).max(10).optional().default([]),
});

const Body = z.object({
  o1: z.record(z.string().regex(/^\d{1,3}$/), z.enum(["correct", "incorrect"])).optional(),
  o2: z.record(z.string().regex(/^\d{1,3}$/), O2Review).optional(),
});

/** Saves reviewer decisions. Moves the attempt to `graded` once nothing is left to review. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const body = Body.parse(await readJson(req));
  const changes: Record<string, unknown>[] = [];

  const updated = await updateAttempt(id, async (a) => {
    changes.length = 0; // reset on optimistic retry
    if (a.status !== "pending_review" && a.status !== "graded")
      throw new ApiError(409, "bad_status", a.status === "published" ? "Natija e’lon qilingan. Avval e’lonni bekor qiling." : "Bu urinish hali tekshiruvga tayyor emas.");
    const key = (await getKey(a.materialId))?.items ?? {};
    const now = Date.now();

    const questions: QuestionResult[] = (a.grading?.questions ?? []).map((q) => ({ ...q }));
    for (const [n, decision] of Object.entries(body.o1 ?? {})) {
      const q = questions.find((x) => String(x.n) === n);
      if (!q || (q.type !== "O1" && q.type !== "O")) throw new ApiError(400, "bad_question", `${n}-topshiriq qisqa javobli emas.`);
      if (q.status !== "needs_review" && q.resolvedBy !== "reviewer") throw new ApiError(400, "not_reviewable", `${n}-topshiriq tekshiruv talab qilmaydi.`);
      const before = { status: q.status, score: q.score };
      q.status = decision;
      q.score = decision === "correct" ? q.max : 0;
      q.resolvedBy = "reviewer";
      changes.push({ n, kind: "O1", before, after: { status: q.status, score: q.score } });
    }

    const o2Reviews: Record<string, O2ReviewRecord> = { ...(a.o2Reviews ?? {}) };
    for (const [n, r] of Object.entries(body.o2 ?? {})) {
      if (taskTypeOf(a.format, Number(n)) !== "O2") throw new ApiError(400, "bad_question", `${n}-topshiriq yozma ish emas.`);
      const k = key[n];
      const keyO2 = k && k.type === "O2" ? (k as KeyO2) : undefined;
      let totals;
      try {
        totals = totalO2(a.format, keyO2, { n: Number(n), max: 0, ...r });
      } catch (e) {
        throw new ApiError(400, "bad_score", (e as Error).message);
      }
      const before = o2Reviews[n] ? { m: o2Reviews[n].m, a: o2Reviews[n].a, total: o2Reviews[n].total } : null;
      o2Reviews[n] = {
        n: Number(n),
        max: a.format.o2Tasks.find((t) => String(t.number) === n)?.maxScore ?? 0,
        m: totals.m,
        a: totals.a,
        criteria: r.criteria,
        comment: r.comment,
        errorTags: r.errorTags,
        total: totals.total,
        reviewedAt: now,
      };
      changes.push({ n, kind: "O2", before, after: { m: totals.m, a: totals.a, total: totals.total } });
    }

    const summary = summarize(questions);
    const o2Done = a.format.o2Tasks.every((t) => o2Reviews[String(t.number)]);
    const status: AttemptStatus = summary.needsReview === 0 && o2Done ? "graded" : "pending_review";
    const patch: Partial<Attempt> = {
      grading: { questions, summary },
      o2Reviews,
      status,
    };
    if (status !== a.status) patch.statusHistory = [...(a.statusHistory ?? []), { status, at: now }];
    return patch;
  });

  await audit("review.save", `attempts/${id}`, { changes, status: updated.status });
  return ok({ status: updated.status, summary: updated.grading?.summary ?? null, o2Reviews: updated.o2Reviews });
});
