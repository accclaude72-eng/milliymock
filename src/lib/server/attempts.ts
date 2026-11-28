import "server-only";
import { randomUUID } from "node:crypto";
import { OPTION_LETTERS, formatIncludes, sectionIndexOf, taskTypeOf } from "../formats";
import { type AnswerValue, type Answers, gradeAttempt, summarize } from "../grading";
import { buildSheet } from "../sheet";
import { advance, currentDeadline, finishAll, initTiming, reconcile, timeSpentMs, type TimingState } from "../timing";
import type { Attempt, AttemptStatus, FileMeta, Material, MaterialKeyDoc, PlayerViewT, Profile, QuestionSheetItem } from "../types";
import { ApiError } from "./http";
import { attemptsOf, getKey, getMaterial } from "./repo";
import { T, getDoc, insertDoc, newId, updateIfRev } from "./supabase";
import { notifyResultPublished } from "./notifications";

export const CLIENT_STALE_MS = 25_000;
export const MAX_O2_FILES = 5;
export const MAX_O2_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_O2_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_O1_LEN = 200;
const MAX_O2_TEXT = 20_000;

/* ------------------------------------------------------------- start */

export async function startAttempt(profile: Profile, materialId: string): Promise<{ attemptId: string; resumed: boolean }> {
  for (let tries = 0; tries < 3; tries++) {
    const existing = (await attemptsOf({ uid: profile.uid })).filter((a) => a.materialId === materialId);
    const inProgress = existing.find((a) => a.status === "in_progress");
    if (inProgress) {
      // Resume — but reconcile first; it may have expired meanwhile.
      const st = await withAttempt(inProgress.id, profile.uid, async () => ({}));
      if (st.status === "in_progress") return { attemptId: inProgress.id, resumed: true };
    }
    const m: Material = await getMaterial(materialId).catch(() => {
      throw new ApiError(404, "material_not_found", "Test materiali topilmadi.");
    });
    if (m.status !== "published") throw new ApiError(403, "not_published", "Bu test hozircha mavjud emas.");
    if (!m.html) throw new ApiError(409, "no_booklet", "Test kitobchasi yuklanmagan.");
    if (!m.keyStatus.complete) throw new ApiError(409, "key_incomplete", "Bu test hali to‘liq tayyor emas.");
    const finishedCount = existing.filter((a) => a.status !== "in_progress").length;
    if (m.attemptLimit != null && finishedCount >= m.attemptLimit)
      throw new ApiError(403, "attempt_limit", `Bu test uchun urinishlar chegarasi (${m.attemptLimit}) tugagan.`);

    const now = Date.now();
    const ref = { id: newId() };
    const durations = m.format.sections.map((s) => (m.timed ? s.minutes * 60_000 : null));
    const attempt: Attempt = {
      id: ref.id,
      uid: profile.uid,
      candidateId: profile.candidateId,
      candidateName: `${profile.firstName} ${profile.lastName}`.trim(),
      materialId: m.id,
      materialTitle: m.title,
      bookletPath: m.html.path,
      subjectCode: m.subjectCode,
      subjectName: m.subjectName,
      format: m.format,
      structure: m.structure,
      mode: m.mode,
      timed: m.timed,
      status: "in_progress",
      statusHistory: [{ status: "in_progress", at: now }],
      timing: initTiming(durations, now),
      answers: {},
      answeredAt: {},
      o2Files: {},
      client: null,
      createdAt: now,
      submittedAt: null,
      finalizeReason: null,
      grading: null,
      o2Reviews: {},
      hasO2: formatIncludes(m.format, "O2"),
      publishedAt: null,
      rev: 0,
    };
    // A unique index allows only one running attempt per candidate+test; a lost race retries and resumes.
    if (await insertDoc(T.attempts, ref.id, attempt)) return { attemptId: ref.id, resumed: false };
  }
  throw new ApiError(409, "busy", "Urinishni boshlab bo‘lmadi. Qayta urinib ko‘ring.");
}

/* ------------------------------------------------------ concurrency core */

type Mutator = (a: Attempt, now: number) => Promise<Partial<Attempt>> | Partial<Attempt>;

/**
 * Optimistic read-modify-write on an attempt: the write only lands if nobody else changed
 * the row in between (same `rev`); otherwise it re-reads and retries.
 */
export async function updateAttempt(id: string, fn: (a: Attempt) => Promise<Partial<Attempt> | null> | Partial<Attempt> | null): Promise<Attempt> {
  for (let tries = 0; tries < 6; tries++) {
    const a = await getDoc<Attempt>(T.attempts, id);
    if (!a) throw new ApiError(404, "attempt_not_found", "Urinish topilmadi.");
    const patch = await fn(a);
    if (!patch || !Object.keys(patch).length) return a;
    const next: Attempt = { ...a, ...patch, rev: a.rev + 1 };
    if (await updateIfRev(T.attempts, id, next, a.rev)) return next;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
  }
  throw new ApiError(409, "busy", "Server band. Bir necha soniyadan so‘ng qayta urinib ko‘ring.");
}

function pushStatus(a: Attempt, list: AttemptStatus[], at: number): Attempt["statusHistory"] {
  return [...(a.statusHistory ?? []), ...list.map((status) => ({ status, at }))];
}

/** Grades and finalizes an attempt whose timing has finished. Pure over its inputs. */
function finalizeFields(a: Attempt, key: MaterialKeyDoc | null, timing: TimingState, reason: "manual" | "timeout", now: number): Partial<Attempt> {
  const questions = gradeAttempt(a.format, key?.items ?? {}, a.answers ?? {});
  const summary = summarize(questions);
  const needsHuman = a.hasO2 || summary.needsReview > 0;
  const status: AttemptStatus = needsHuman ? "pending_review" : "published";
  return {
    timing,
    status,
    statusHistory: pushStatus(a, ["submitted", "auto_graded", status], now),
    submittedAt: timing.finishedAt ?? now,
    finalizeReason: reason,
    grading: { questions, summary },
    publishedAt: status === "published" ? now : null,
  };
}

/**
 * Runs a read-modify-write on an attempt inside a transaction, always applying
 * server-side deadline reconciliation first. If time has run out the attempt is
 * finalized and graded atomically, and the mutator is NOT applied.
 * `uid === null` means admin access.
 */
export async function withAttempt(
  id: string,
  uid: string | null,
  mutator: Mutator,
  opts: { finalize?: "manual" } = {},
): Promise<Attempt> {
  let key: MaterialKeyDoc | null | undefined;
  let result: Attempt | null = null;
  const saved = await updateAttempt(id, async (a) => {
    if (uid !== null && a.uid !== uid) throw new ApiError(404, "attempt_not_found", "Urinish topilmadi.");
    result = a;
    // Finished attempts are frozen: candidate mutations are never applied (idempotent double-submit too).
    if (a.status !== "in_progress") return null;
    const now = Date.now();
    const r = opts.finalize ? finishAll(a.timing, now) : reconcile(a.timing, now);
    if (r.state.finished) {
      if (key === undefined) key = await getKey(a.materialId);
      return finalizeFields(a, key, r.state, opts.finalize ?? "timeout", now);
    }
    const reconciled: Attempt = { ...a, timing: r.state };
    const patch = await mutator(reconciled, now);
    const full = { ...patch, ...(r.changed && !patch.timing ? { timing: r.state } : {}) };
    result = { ...reconciled, ...full };
    return Object.keys(full).length ? full : null;
  });
  // Auto-published right now (no written part) → tell the student on Telegram (deduplicated).
  if (saved.status === "published" && saved.publishedAt && Date.now() - saved.publishedAt < 60_000) await notifyResultPublished(saved);
  // When nothing was written, return the reconciled in-memory view (e.g. fresh deadline).
  return saved.rev !== (result as Attempt | null)?.rev ? saved : (result ?? saved);
}

/* ------------------------------------------------------------ validation */

function claimClient(a: Attempt, clientId: string, now: number, takeover: boolean): Partial<Attempt> {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(clientId)) throw new ApiError(400, "bad_client", "Noto‘g‘ri sessiya identifikatori.");
  if (a.client && a.client.id !== clientId && now - a.client.seenAt < CLIENT_STALE_MS && !takeover) {
    throw new ApiError(409, "conflict", "Bu imtihon boshqa oyna yoki qurilmada ochiq. Javoblar ikki joydan bir vaqtda yozilmasligi kerak.");
  }
  return { client: { id: clientId, seenAt: now } };
}

function validateAnswer(item: QuestionSheetItem, v: AnswerValue): AnswerValue {
  switch (item.type) {
    case "Y1": {
      const allowed = OPTION_LETTERS.slice(0, item.options);
      if (typeof v !== "string" || !allowed.includes(v)) throw new Error("bad");
      return v;
    }
    case "Y2": {
      const allowed = OPTION_LETTERS.slice(0, item.right);
      if (!Array.isArray(v) || v.length !== item.left || v.some((x) => typeof x !== "string" || (x !== "" && !allowed.includes(x)))) throw new Error("bad");
      return v.map(String);
    }
    case "O1":
    case "O": {
      if (typeof v !== "string" || v.length > MAX_O1_LEN) throw new Error("bad");
      return v;
    }
    case "O2": {
      if (typeof v !== "object" || v === null || Array.isArray(v) || typeof v.text !== "string" || v.text.length > MAX_O2_TEXT) throw new Error("bad");
      return { text: v.text };
    }
  }
}

export interface SaveResult {
  accepted: string[];
  rejected: { n: string; reason: string }[];
}

export async function saveAnswers(
  id: string,
  uid: string,
  clientId: string,
  changes: Record<string, AnswerValue | null>,
  takeover: boolean,
): Promise<{ attempt: Attempt; result: SaveResult }> {
  const result: SaveResult = { accepted: [], rejected: [] };
  const attempt = await withAttempt(id, uid, (a, now) => {
    const patch: Partial<Attempt> = claimClient(a, clientId, now, takeover);
    const sheet = new Map(buildSheet(a.format, a.structure).map((s) => [s.n, s]));
    const answers: Answers = { ...(a.answers ?? {}) };
    const answeredAt = { ...(a.answeredAt ?? {}) };
    let touched = false;
    for (const [n, v] of Object.entries(changes).slice(0, 100)) {
      const num = Number(n);
      const item = sheet.get(num);
      if (!Number.isInteger(num) || !item) {
        result.rejected.push({ n, reason: "Bunday topshiriq yo‘q" });
        continue;
      }
      if (item.section !== a.timing.index) {
        result.rejected.push({ n, reason: "Bu bo‘lim yopilgan" });
        continue;
      }
      try {
        if (v === null || v === "" || (Array.isArray(v) && v.every((x) => x === ""))) delete answers[n];
        else answers[n] = validateAnswer(item, v);
        answeredAt[n] = now;
        touched = true;
        result.accepted.push(n);
      } catch {
        result.rejected.push({ n, reason: "Javob formati noto‘g‘ri" });
      }
    }
    if (touched) {
      patch.answers = answers;
      patch.answeredAt = answeredAt;
    }
    return patch;
  });
  if (attempt.status !== "in_progress") {
    // Time ran out before these changes could be applied.
    return { attempt, result: { accepted: [], rejected: Object.keys(changes).map((n) => ({ n, reason: "Vaqt tugagan" })) } };
  }
  return { attempt, result };
}

export async function heartbeat(id: string, uid: string, clientId: string, takeover: boolean): Promise<Attempt> {
  return withAttempt(id, uid, (a, now) => claimClient(a, clientId, now, takeover));
}

export async function advanceSection(id: string, uid: string, clientId: string, fromIndex: number): Promise<Attempt> {
  // Claim the session first (detects a second tab). Idempotent: a repeated click
  // for an already-closed section is a no-op. Closing the last section == final submission.
  const peek = await withAttempt(id, uid, (a, now) => claimClient(a, clientId, now, false));
  if (peek.status !== "in_progress" || peek.timing.index !== fromIndex) return peek;
  if (fromIndex === peek.timing.durationsMs.length - 1) return submitAttempt(id, uid, clientId);
  return withAttempt(id, uid, (a, now) => {
    const r = advance(a.timing, now, fromIndex);
    return r.changed ? { timing: r.state } : {};
  });
}

export async function submitAttempt(id: string, uid: string, clientId: string): Promise<Attempt> {
  return withAttempt(
    id,
    uid,
    (a, now) => claimClient(a, clientId, now, true),
    { finalize: "manual" },
  );
}

/* ------------------------------------------------------------------ files */

export async function registerFile(
  id: string,
  uid: string,
  n: string,
  file: { path: string; name: string; size: number; contentType: string },
): Promise<{ attempt: Attempt; meta: FileMeta }> {
  const meta: FileMeta = {
    id: randomUUID(),
    name: file.name.slice(0, 180),
    size: file.size,
    contentType: file.contentType,
    path: file.path,
    uploadedAt: Date.now(),
  };
  const attempt = await withAttempt(id, uid, (a) => {
    const num = Number(n);
    if (taskTypeOf(a.format, num) !== "O2") throw new ApiError(400, "not_o2", "Fayl faqat yozma ish topshirig‘iga yuklanadi.");
    if (sectionIndexOf(a.format, num) !== a.timing.index) throw new ApiError(409, "section_locked", "Bu bo‘lim hozir ochiq emas.");
    const list = a.o2Files?.[n] ?? [];
    if (list.length >= MAX_O2_FILES) throw new ApiError(400, "too_many_files", `Har bir topshiriqqa ko‘pi bilan ${MAX_O2_FILES} ta fayl yuklash mumkin.`);
    return { o2Files: { ...(a.o2Files ?? {}), [n]: [...list, meta] } };
  });
  if (attempt.status !== "in_progress") throw new ApiError(409, "time_over", "Vaqt tugagan — fayl qabul qilinmadi.");
  return { attempt, meta };
}

export async function removeFile(id: string, uid: string, n: string, fileId: string): Promise<{ attempt: Attempt; removed: FileMeta | null }> {
  let removed: FileMeta | null = null;
  const attempt = await withAttempt(id, uid, (a) => {
    if (sectionIndexOf(a.format, Number(n)) !== a.timing.index) throw new ApiError(409, "section_locked", "Bu bo‘lim yopilgan.");
    const list = a.o2Files?.[n] ?? [];
    removed = list.find((x) => x.id === fileId) ?? null;
    if (!removed) return {};
    return { o2Files: { ...(a.o2Files ?? {}), [n]: list.filter((x) => x.id !== fileId) } };
  });
  if (attempt.status !== "in_progress") throw new ApiError(409, "time_over", "Vaqt tugagan — fayllarni o‘zgartirib bo‘lmaydi.");
  return { attempt, removed };
}

/* ------------------------------------------------------------ client view */

export function playerView(a: Attempt): PlayerViewT {
  const now = Date.now();
  return {
    id: a.id,
    status: a.status,
    materialId: a.materialId,
    materialTitle: a.materialTitle,
    subjectName: a.subjectName,
    subjectCode: a.subjectCode,
    candidateId: a.candidateId,
    candidateName: a.candidateName,
    mode: a.mode,
    timed: a.timed,
    format: a.format,
    sheet: buildSheet(a.format, a.structure),
    timing: {
      index: a.timing.index,
      finished: a.timing.finished,
      deadline: currentDeadline(a.timing),
      starts: a.timing.starts,
      ends: a.timing.ends,
      durationsMs: a.timing.durationsMs,
    },
    answers: a.answers ?? {},
    o2Files: Object.fromEntries(
      Object.entries(a.o2Files ?? {}).map(([k, list]) => [k, list.map(({ id, name, size, contentType, uploadedAt }) => ({ id, name, size, contentType, uploadedAt }))]),
    ),
    rev: a.rev,
    serverNow: now,
  };
}

export function attemptTimeSpent(a: Attempt): number {
  return timeSpentMs(a.timing, a.submittedAt ?? Date.now());
}
