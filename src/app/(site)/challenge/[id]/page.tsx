"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { OptionList, type PublicQuestion, QuestionStem } from "@/components/question-view";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { ACHIEVEMENTS } from "@/lib/gamify";
import { cx, fmtClock } from "@/lib/format-utils";

interface View {
  id: string;
  challenge: { id: string; title: string; subjectCode: string; timeLimitSec: number; xp: number };
  status: "in_progress" | "submitted" | "expired";
  deadline: number;
  serverNow: number;
  answers: Record<string, string>;
  questions: { id: string; subjectCode: string; topic: string | null; stem: string; options: { letter: string; html: string }[] }[];
  result: { correct: number; total: number; percent: number; durationMs: number } | null;
  review: Record<string, { correct: string | null }> | null;
}
interface Finish {
  correct: number;
  total: number;
  percent: number;
  late: boolean;
  xp: { reason: string; amount: number }[];
  achievements: string[];
}

const asQuestion = (q: View["questions"][number], i: number): PublicQuestion => ({ id: q.id, n: i + 1, materialId: "", subjectCode: q.subjectCode, topic: q.topic, type: "Y1", stem: q.stem, options: q.options });
const XP_LABEL: Record<string, string> = { challenge: "Challenge yakunlandi", challenge_bonus: "Yuqori natija bonusi", streak: "Streak bonusi" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Runner />}</RequireCandidate>
    </Suspense>
  );
}

function Runner() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [fin, setFin] = useState<Finish | null>(null);
  const skew = useRef(0);
  const saveT = useRef<number | undefined>(undefined);

  const load = useCallback(() => {
    api<View>(`/api/challenges/attempts/${id}`)
      .then((d) => {
        skew.current = d.serverNow - Date.now();
        setV(d);
        setAnswers(d.answers ?? {});
      })
      .catch((e) => setErr(errorText(e)));
  }, [id]);
  useEffect(load, [load]);

  const sent = useRef(false); // the 500 ms timer may fire again before state updates — submit only once
  const submit = useCallback(async () => {
    if (!v || sent.current || v.status !== "in_progress") return;
    sent.current = true;
    setSubmitting(true);
    window.clearTimeout(saveT.current);
    try {
      const r = await api<Finish>(`/api/challenges/attempts/${id}`, { method: "POST", body: { action: "submit", answers } });
      setFin(r);
      load();
    } catch (e) {
      setErr(errorText(e));
      load();
    } finally {
      setSubmitting(false);
    }
  }, [v, id, answers, load]);

  // Server-synced countdown; auto-submits at zero.
  useEffect(() => {
    if (!v || v.status !== "in_progress") return;
    const tick = () => {
      const ms = v.deadline - (Date.now() + skew.current);
      setLeft(Math.max(0, ms));
      if (ms <= 0) submit();
    };
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [v, submit]);

  const pick = (qid: string, letter: string) => {
    const next = { ...answers, [qid]: letter };
    setAnswers(next);
    // Debounced save, so a closed tab or lost connection doesn't lose answers.
    window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => {
      api(`/api/challenges/attempts/${id}`, { method: "POST", body: { action: "save", answers: next } }).catch(() => undefined);
    }, 600);
  };

  if (err && !v)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">
          {err} <Link href="/challenge">Challenge’ga qaytish</Link>
        </Alert>
      </div>
    );
  if (!v) return <PageLoader />;

  /* ---------------------------------------------------------- result */
  if (v.status !== "in_progress" && v.result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="sheet-hard crop p-6 text-center sm:p-8">
          <p className="eyebrow">{v.challenge.title}</p>
          <p className="num mt-3 text-7xl font-semibold">{v.result.percent}%</p>
          <p className="mt-1 text-muted">
            {v.result.correct}/{v.result.total} to‘g‘ri · {fmtClock(v.result.durationMs ?? 0)}
            {v.status === "expired" ? " · vaqt tugagan" : ""}
          </p>
          {fin && fin.xp.length > 0 && (
            <ul className="mt-5 flex flex-wrap justify-center gap-2">
              {fin.xp.map((x) => (
                <li key={x.reason} className="chip chip-warn animate-rise !text-sm">
                  +{x.amount} XP · {XP_LABEL[x.reason] ?? x.reason}
                </li>
              ))}
            </ul>
          )}
          {fin && fin.xp.length === 0 && !fin.late && <p className="mt-4 text-sm text-muted">XP berilmadi: savollarning kamida yarmiga javob bering yoki bu challenge uchun XP allaqachon olingan.</p>}
          {fin && fin.achievements.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow">Yangi yutuq!</p>
              <ul className="mt-2 flex flex-wrap justify-center gap-3">
                {fin.achievements.map((c) => {
                  const a = ACHIEVEMENTS.find((x) => x.code === c);
                  return (
                    <li key={c} className="sheet animate-rise px-4 py-3">
                      <span className="text-3xl">{a?.icon}</span>
                      <p className="text-sm font-semibold">{a?.title}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/challenge" className="btn">
              Challenge’lar
            </Link>
            <Link href="/reyting" className="btn btn-primary">
              Reytingni ko‘rish
            </Link>
          </div>
        </div>
        <h2 className="display mt-10 text-3xl">Javoblar tahlili</h2>
        <ol className="mt-4 space-y-4">
          {v.questions.map((q, k) => {
            const mine = (v.answers ?? {})[q.id] ?? null;
            const right = v.review?.[q.id]?.correct ?? null;
            return (
              <li key={q.id} className="sheet p-4">
                <p className="eyebrow">
                  {k + 1}-savol {mine == null ? "· javobsiz" : mine === right ? "· ✓ to‘g‘ri" : "· ✗ noto‘g‘ri"}
                </p>
                <QuestionStem q={asQuestion(q, k)} className="mt-2" />
                <OptionList q={asQuestion(q, k)} correct={right} wrong={mine && mine !== right ? mine : null} />
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  /* ---------------------------------------------------------- running */
  const q = v.questions[i];
  const answered = v.questions.filter((x) => answers[x.id]).length;
  const urgent = left < 60_000;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="sticky top-16 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-hair bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[3px] sm:border">
        <p className="min-w-0 truncate text-sm font-semibold">{v.challenge.title}</p>
        <span className={cx("num chip !text-base", urgent ? "chip-accent animate-pulse" : "chip-ink")} aria-live="polite">
          ⏱ {fmtClock(left)}
        </span>
      </div>
      <nav aria-label="Savollar" className="mt-4 flex flex-wrap gap-1.5">
        {v.questions.map((x, k) => (
          <button key={x.id} type="button" onClick={() => setI(k)} className={cx("num h-9 w-9 rounded-[3px] border text-sm", k === i ? "border-accent bg-accent text-white" : answers[x.id] ? "border-ink bg-ink text-paper" : "border-hair")} aria-label={`${k + 1}-savol${answers[x.id] ? ", javob berilgan" : ""}`}>
            {k + 1}
          </button>
        ))}
      </nav>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {q && (
        <section className="sheet-hard mt-4 p-5 sm:p-6">
          <p className="eyebrow">
            {i + 1}/{v.questions.length}
            {q.topic ? ` · ${q.topic}` : ""}
          </p>
          <QuestionStem q={asQuestion(q, i)} className="mt-3" />
          <OptionList q={asQuestion(q, i)} picked={answers[q.id] ?? null} onPick={(L) => pick(q.id, L)} disabled={submitting} />
          <div className="mt-5 flex items-center justify-between gap-2">
            <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              ← Oldingi
            </button>
            {i + 1 < v.questions.length ? (
              <button type="button" className="btn" onClick={() => setI(i + 1)}>
                Keyingi →
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => (answered < v.questions.length && !window.confirm(`${v.questions.length - answered} ta savol javobsiz. Yakunlaysizmi?`) ? undefined : submit())}>
                {submitting && <Spinner />} Yakunlash
              </button>
            )}
          </div>
        </section>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        {answered}/{v.questions.length} javob berildi · javoblar avtomatik saqlanadi · vaqt tugasa avtomatik topshiriladi
      </p>
    </div>
  );
}
