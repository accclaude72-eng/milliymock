import "server-only";
import { o2MaxFor } from "../formats";
import type { AnswerKey, AnswerValue, KeyItem } from "../grading";
import { buildSheet } from "../sheet";
import type { Attempt, Material } from "../types";
import { attemptTimeSpent } from "./attempts";

function keyToDisplay(k: KeyItem | undefined): string | string[] | null {
  if (!k) return null;
  if (k.type === "Y1") return k.correct;
  if (k.type === "Y2") return k.pairs;
  if (k.type === "O1" || k.type === "O") return k.accepted.join(" / ") + (k.unit ? ` (${k.unit})` : "");
  return null;
}

/**
 * Builds the candidate-facing result. Correct answers are only included when the
 * attempt is published AND the material allows answer disclosure.
 */
export function candidateResult(a: Attempt, material: Pick<Material, "revealAnswers"> | null, key: AnswerKey | null) {
  const published = a.status === "published";
  const reveal = published && !!material?.revealAnswers && !!key;
  const sheet = buildSheet(a.format, a.structure);
  const qr = new Map((a.grading?.questions ?? []).map((q) => [q.n, q]));

  const questions = sheet
    .filter((s) => s.type !== "O2")
    .map((s) => {
      const r = qr.get(s.n);
      const ans: AnswerValue | undefined = a.answers?.[String(s.n)];
      return {
        n: s.n,
        type: s.type,
        status: r?.status ?? "unanswered",
        score: r?.score ?? 0,
        max: r?.max ?? 1,
        topic: r?.topic ?? null,
        pairs: r?.pairs ?? null,
        answer: ans ?? null,
        correct: reveal ? keyToDisplay(key?.[String(s.n)]) : null,
        answeredAt: a.answeredAt?.[String(s.n)] ?? null,
      };
    });

  const o2 = sheet
    .filter((s) => s.type === "O2")
    .map((s) => {
      const rev = a.o2Reviews?.[String(s.n)];
      const k = key?.[String(s.n)];
      const criteria = k && k.type === "O2" ? k.criteria : [];
      const ans = a.answers?.[String(s.n)];
      return {
        n: s.n,
        max: o2MaxFor(a.format, s.n),
        text: ans && typeof ans === "object" && !Array.isArray(ans) ? ans.text : "",
        files: (a.o2Files?.[String(s.n)] ?? []).map(({ id, name, size, contentType, uploadedAt }) => ({ id, name, size, contentType, uploadedAt })),
        // Expert scores are visible to the candidate only after publication.
        review: published && rev ? { m: rev.m, a: rev.a, total: rev.total, comment: rev.comment ?? "", criteria: rev.criteria, errorTags: rev.errorTags ?? [] } : null,
        criteria: published ? criteria.map((c) => ({ id: c.id, label: c.label, component: c.component, max: c.max })) : [],
        status: published ? (rev ? "graded" : "not_reviewed") : "pending_review",
      };
    });

  return {
    id: a.id,
    status: a.status,
    materialId: a.materialId,
    materialTitle: a.materialTitle,
    subjectName: a.subjectName,
    subjectCode: a.subjectCode,
    candidateId: a.candidateId,
    candidateName: a.candidateName,
    format: {
      label: a.format.label,
      version: a.format.version,
      totalTasks: a.format.totalTasks,
      totalMinutes: a.format.totalMinutes,
      assessmentNote: a.format.assessmentNote,
      raschAvailable: !!a.format.raschParameterSetId,
      y2Scoring: a.format.y2Scoring,
      sourceUrl: a.format.sourceUrl,
    },
    mode: a.mode,
    createdAt: a.createdAt,
    submittedAt: a.submittedAt,
    publishedAt: a.publishedAt,
    finalizeReason: a.finalizeReason,
    timeSpentMs: attemptTimeSpent(a),
    sectionTimes: a.format.sections.map((s, i) => ({
      title: s.title,
      minutes: s.minutes,
      spentMs: a.timing.starts[i] != null && a.timing.ends[i] != null ? (a.timing.ends[i] as number) - (a.timing.starts[i] as number) : null,
    })),
    summary: a.grading?.summary ?? null,
    questions,
    o2,
    revealAnswers: reveal,
    o2Total: published ? o2.reduce((s, x) => s + (x.review?.total ?? 0), 0) : null,
    o2Max: o2.reduce((s, x) => s + x.max, 0),
  };
}
export type CandidateResult = ReturnType<typeof candidateResult>;
