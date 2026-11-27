"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BookletFrame } from "@/components/booklet-frame";
import { StackBar, TopicBars } from "@/components/charts";
import { RequireCandidate } from "@/components/guards";
import { Alert, PageLoader } from "@/components/ui";
import { ApiClientError, api, errorText } from "@/lib/api";
import { cx, fmtDateTime, fmtDuration, fmtNum } from "@/lib/format-utils";
import type { AnswerValue, RawSummary } from "@/lib/grading";
import { ATTEMPT_STATUS_LABEL, type AttemptStatus } from "@/lib/types";

interface Result {
  id: string;
  status: AttemptStatus;
  materialId: string;
  materialTitle: string;
  subjectName: string;
  subjectCode: string;
  candidateId: string;
  candidateName: string;
  format: { label: string; version: string; totalTasks: number; totalMinutes: number; assessmentNote: string; raschAvailable: boolean; y2Scoring: string; sourceUrl: string };
  mode: string;
  createdAt: number;
  submittedAt: number | null;
  publishedAt: number | null;
  finalizeReason: "manual" | "timeout" | null;
  timeSpentMs: number;
  sectionTimes: { title: string; minutes: number; spentMs: number | null }[];
  summary: RawSummary | null;
  questions: {
    n: number;
    type: string;
    status: string;
    score: number;
    max: number;
    topic: string | null;
    pairs: boolean[] | null;
    answer: AnswerValue | null;
    correct: string | string[] | null;
  }[];
  o2: {
    n: number;
    max: number;
    text: string;
    files: { id: string; name: string; size: number; contentType: string; uploadedAt: number }[];
    review: { m: number; a: number; total: number; comment: string; criteria: { id: string; score: number; comment?: string }[]; errorTags: string[] } | null;
    criteria: { id: string; label: string; component: "M" | "A"; max: number }[];
    status: "pending_review" | "graded" | "not_reviewed";
  }[];
  revealAnswers: boolean;
  bookletUrl: string | null;
  o2Total: number | null;
  o2Max: number;
}

const STATUS_META: Record<string, { icon: string; label: string; cls: string }> = {
  correct: { icon: "✓", label: "To‘g‘ri", cls: "text-ok" },
  incorrect: { icon: "✕", label: "Noto‘g‘ri", cls: "text-accent" },
  partial: { icon: "◐", label: "Qisman", cls: "text-warn" },
  unanswered: { icon: "○", label: "Javobsiz", cls: "text-muted" },
  needs_review: { icon: "?", label: "Tekshiruvda", cls: "text-info" },
};

const ERROR_REASONS = ["Bilim yetishmadi", "Hisoblashda xato", "Shartni noto‘g‘ri tushundim", "Vaqt yetmadi", "E’tiborsizlik", "Boshqa"];

function showAnswer(a: AnswerValue | null | string | string[]): string {
  if (a == null || a === "") return "—";
  if (Array.isArray(a)) return a.map((x, i) => `${i + 1}–${x || "·"}`).join("  ");
  if (typeof a === "object") return a.text;
  return a;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <ResultView />}</RequireCandidate>
    </Suspense>
  );
}

function ResultView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "wrong" | "unanswered">("all");
  // Rendered only in the browser (behind the auth guard).
  const [reasons, setReasons] = useState<Record<string, string>>(() => {
    try {
      return typeof window === "undefined" ? {} : JSON.parse(localStorage.getItem(`mm:reasons:${id}`) ?? "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    api<Result>(`/api/attempts/${id}/result`)
      .then(setR)
      .catch((e) => {
        if (e instanceof ApiClientError && e.code === "in_progress") router.replace(`/urinish/${id}`);
        else setErr(errorText(e));
      });
  }, [id, router]);

  const topics = useMemo(
    () =>
      Object.entries(r?.summary?.byTopic ?? {})
        .map(([label, b]) => ({ label, value: b.max ? (b.score / b.max) * 100 : 0, detail: `${b.score}/${b.max}` }))
        .sort((a, b) => a.value - b.value),
    [r],
  );

  const reviewState = useMemo(() => {
    const marks: Record<string, { status: string; answer: string | null; correct: string | null }> = {};
    for (const q of r?.questions ?? []) {
      if (q.type !== "Y1" && q.type !== "O1" && q.type !== "O") continue;
      marks[String(q.n)] = {
        status: q.status,
        answer: typeof q.answer === "string" ? q.answer : null,
        correct: q.correct == null ? null : Array.isArray(q.correct) ? q.correct.join(" / ") : q.correct,
      };
    }
    return { mode: "review", marks };
  }, [r]);

  if (err)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="Natijani ochib bo‘lmadi">
          {err} <Link href="/kabinet">Kabinetga qaytish</Link>
        </Alert>
      </div>
    );
  if (!r) return <PageLoader label="Natija yuklanmoqda…" />;

  const s = r.summary;
  const published = r.status === "published";
  const answeredN = r.questions.filter((q) => q.status !== "unanswered").length;
  const avgPerQ = answeredN ? r.timeSpentMs / Math.max(1, r.questions.length + r.o2.length) : 0;
  const shown = r.questions.filter((q) => (filter === "all" ? true : filter === "wrong" ? q.status === "incorrect" || q.status === "partial" : q.status === "unanswered"));

  const setReason = (n: number, v: string) => {
    setReasons((o) => {
      const next = { ...o, [n]: v };
      try {
        localStorage.setItem(`mm:reasons:${id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 print:max-w-none print:px-0 print:py-0">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="font-mono text-xs text-muted no-print">
            <Link href="/kabinet" className="hover:text-ink">
              Kabinet
            </Link>{" "}
            / Natija
          </nav>
          <p className="eyebrow mt-3">
            {r.subjectName} · {r.format.label}
          </p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">{r.materialTitle}</h1>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            <span>
              {r.candidateName} · <span className="num">{r.candidateId}</span>
            </span>
            <span className="num">Topshirildi: {fmtDateTime(r.submittedAt)}</span>
            {r.finalizeReason === "timeout" && <span className="chip chip-warn">Vaqt tugashi bilan avtomatik topshirilgan</span>}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button type="button" className="btn btn-sm" onClick={() => window.print()}>
            PDF / chop etish
          </button>
          <Link href={`/fanlar/${r.subjectCode}`} className="btn btn-sm btn-ink">
            Yana mashq qilish
          </Link>
        </div>
      </div>

      {/* status */}
      <div className="mt-6">
        {published ? (
          <Alert tone="ok" title="Yakuniy natija e’lon qilingan">
            {r.publishedAt && `E’lon qilingan: ${fmtDateTime(r.publishedAt)}.`} {r.o2.length > 0 && "Yozma ishlar ekspert tomonidan baholangan."}
          </Alert>
        ) : (
          <Alert tone="info" title={`Holat: ${ATTEMPT_STATUS_LABEL[r.status]}`}>
            Test qismi avtomatik tekshirildi.{" "}
            {r.o2.length > 0 ? "Yozma ishlar (O2) ekspert tekshiruvida — natija hali yakuniy emas." : ""}
            {s && s.needsReview > 0 ? ` ${s.needsReview} ta qisqa javob ekspert tomonidan qo‘shimcha tekshirilmoqda.` : ""}
          </Alert>
        )}
      </div>

      {/* metrics */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="sheet-hard p-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
            <div>
              <p className="eyebrow">1 · Xom test natijasi {published ? "" : "· dastlabki"}</p>
              <p className="mt-1 text-sm text-muted">{r.o2.length ? "Y1, Y2 va O1 topshiriqlari" : "Barcha topshiriqlar"} · avtomatik tekshiruv</p>
            </div>
            {s && (
              <p className="num text-6xl font-semibold leading-none">
                {fmtNum(s.percent)}
                <span className="text-2xl text-muted">%</span>
              </p>
            )}
          </div>
          {s && (
            <>
              <p className="num mt-4 text-lg">
                <span className="font-semibold">{fmtNum(s.score, 2)}</span> / {s.max} ball
                {r.format.y2Scoring === "per_pair" && <span className="ml-2 text-xs text-muted">(Y2 — har bir juftlik alohida)</span>}
              </p>
              <div className="mt-4">
                <StackBar
                  parts={[
                    { label: "To‘g‘ri", value: s.correct, className: "bg-ok" },
                    { label: "Qisman", value: s.partial, className: "bg-warn" },
                    { label: "Noto‘g‘ri", value: s.incorrect, className: "bg-accent" },
                    { label: "Javobsiz", value: s.unanswered, className: "bg-hair" },
                    { label: "Tekshiruvda", value: s.needsReview, className: "bg-info" },
                  ]}
                />
              </div>
            </>
          )}
        </section>

        <div className="grid gap-4">
          <section className="sheet p-5">
            <p className="eyebrow">2 · Rasch balli</p>
            {r.format.raschAvailable ? (
              <p className="mt-2 text-sm">Kalibrlangan parametrlar mavjud.</p>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Kalibratsiya ma’lumotlari mavjud emas — Rasch balli hisoblanmaydi va ko‘rsatilmaydi.</p>
            )}
            <p className="mt-2 text-xs text-muted">{r.format.assessmentNote}</p>
          </section>
          <section className="sheet p-5">
            <p className="eyebrow">3 · O2 yozma ish</p>
            {r.o2.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">Bu fan formatida yozma ish yo‘q.</p>
            ) : published && r.o2Total !== null ? (
              <p className="num mt-2 text-3xl font-semibold">
                {fmtNum(r.o2Total)} <span className="text-lg text-muted">/ {r.o2Max}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Ekspert tekshiruvida. Maksimal: {r.o2Max} ball.</p>
            )}
          </section>
          <section className="sheet p-5">
            <p className="eyebrow">4–5 · Taxminiy ko‘rsatkich va rasmiy daraja</p>
            <p className="mt-2 text-sm text-ink-2">Rasmiy darajani aniqlash uchun kalibratsiya ma’lumotlari yetarli emas. Platforma o‘z taxminiy modelini qo‘llamaydi.</p>
          </section>
        </div>
      </div>

      {/* breakdown */}
      {s && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="sheet p-5">
            <h2 className="display text-2xl">Topshiriq turlari</h2>
            <div className="mt-4">
              <TopicBars rows={Object.entries(s.byType).map(([label, b]) => ({ label, value: b.max ? (b.score / b.max) * 100 : 0, detail: `${b.score}/${b.max}` }))} />
            </div>
          </section>
          <section className="sheet p-5 lg:col-span-2">
            <h2 className="display text-2xl">Mavzular bo‘yicha</h2>
            {topics.length ? (
              <div className="mt-4">
                <TopicBars rows={topics} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Bu variant savollariga mavzular biriktirilmagan.</p>
            )}
            {topics.filter((t) => t.value < 50).length > 0 && (
              <p className="mt-4 border-t border-hair pt-3 text-sm no-print">
                Zaif mavzular: <span className="font-semibold">{topics.filter((t) => t.value < 50).map((t) => t.label).join("; ")}</span>.{" "}
                <Link href={`/fanlar/${r.subjectCode}`} className="link">
                  Shu mavzularni qayta mashq qilish →
                </Link>
              </p>
            )}
          </section>
        </div>
      )}

      <section className="sheet mt-6 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="eyebrow">Sarflangan vaqt</p>
          <p className="num mt-1 text-2xl font-semibold">{fmtDuration(r.timeSpentMs)}</p>
        </div>
        <div>
          <p className="eyebrow">Har bir topshiriqqa o‘rtacha</p>
          <p className="num mt-1 text-2xl font-semibold">{avgPerQ ? `${fmtNum(avgPerQ / 60000)} daq.` : "—"}</p>
        </div>
        <div>
          <p className="eyebrow">Bosqichlar</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {r.sectionTimes.map((t) => (
              <li key={t.title} className="flex justify-between gap-2">
                <span className="truncate">{t.title}</span>
                <span className="num shrink-0">{t.spentMs !== null ? fmtDuration(t.spentMs) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* O2 details */}
      {r.o2.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-3xl">Yozma ishlar</h2>
          <div className="mt-4 grid gap-4">
            {r.o2.map((t) => (
              <article key={t.n} className="sheet p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    <span className="num mr-2">{t.n}</span>topshiriq
                  </h3>
                  {t.review ? (
                    <span className="num text-xl font-semibold">
                      {fmtNum(t.review.total)} / {t.max}
                    </span>
                  ) : (
                    <span className="chip chip-info">{t.status === "pending_review" ? "Ekspert tekshiruvida" : "Baholanmagan"}</span>
                  )}
                </div>
                {t.review && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="border border-hair p-3">
                      <p className="eyebrow">M · yechim usuli</p>
                      <p className="num mt-1 text-2xl font-semibold">{fmtNum(t.review.m)}</p>
                    </div>
                    <div className="border border-hair p-3">
                      <p className="eyebrow">A · hisob-kitob</p>
                      <p className="num mt-1 text-2xl font-semibold">{fmtNum(t.review.a)}</p>
                    </div>
                  </div>
                )}
                {t.review && t.criteria.length > 0 && (
                  <table className="table mt-3">
                    <thead>
                      <tr>
                        <th>Mezon</th>
                        <th>Komponent</th>
                        <th className="text-right">Ball</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.criteria.map((c) => {
                        const sc = t.review?.criteria.find((x) => x.id === c.id);
                        return (
                          <tr key={c.id}>
                            <td>
                              {c.label}
                              {sc?.comment && <p className="mt-0.5 text-xs text-muted">{sc.comment}</p>}
                            </td>
                            <td className="num">{c.component}</td>
                            <td className="num text-right">
                              {fmtNum(sc?.score ?? 0)} / {c.max}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {t.review?.comment && <p className="mt-3 border-l-[3px] border-accent pl-3 text-sm">{t.review.comment}</p>}
                {t.review && t.review.errorTags.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1">
                    {t.review.errorTags.map((x) => (
                      <span key={x} className="chip chip-warn">
                        {x}
                      </span>
                    ))}
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold">Mening javobim</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words border border-hair bg-paper p-3 font-sans text-sm">{t.text || "Matn kiritilmagan."}</pre>
                  {t.files.length > 0 && (
                    <ul className="mt-2 text-sm">
                      {t.files.map((f) => (
                        <li key={f.id}>
                          <FileLink attemptId={r.id} file={f} />
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* review inside the booklet */}
      {r.bookletUrl && (
        <section className="mt-10 no-print">
          <h2 className="display text-3xl">Kitobchada tekshirish</h2>
          <p className="mt-1 text-sm text-ink-2">
            Javoblaringiz kitobchaning o‘zida ko‘rsatiladi: <span className="font-semibold text-ok">yashil</span> — to‘g‘ri,{" "}
            <span className="font-semibold text-accent">qizil</span> — noto‘g‘ri{r.revealAnswers ? ", to‘g‘ri javob yonida ko‘rsatiladi" : ""}. Bu imkoniyat kitobcha qo‘llab-quvvatlasa ishlaydi.
          </p>
          <div className="sheet mt-4 h-[78vh] overflow-hidden">
            <BookletFrame url={r.bookletUrl} title="Tekshirilgan test kitobchasi" bridge={{ state: reviewState }} />
          </div>
        </section>
      )}

      {/* question review */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-3xl">Savollar tahlili</h2>
          <div className="flex gap-1 no-print" role="group" aria-label="Filtr">
            {(
              [
                ["all", "Barchasi"],
                ["wrong", "Xatolar"],
                ["unanswered", "Javobsiz"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} className={cx("btn btn-sm", filter === k ? "btn-ink" : "btn-ghost")} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {!r.revealAnswers && (
          <p className="mt-2 text-sm text-muted">
            {published ? "Administrator bu variant uchun to‘g‘ri javoblarni ko‘rsatishga ruxsat bermagan." : "To‘g‘ri javoblar natija e’lon qilingandan keyin (agar ruxsat berilgan bo‘lsa) ko‘rsatiladi."}
          </p>
        )}
        <div className="sheet mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>№</th>
                <th>Tur</th>
                <th>Holat</th>
                <th>Javobingiz</th>
                {r.revealAnswers && <th>To‘g‘ri javob</th>}
                <th>Mavzu</th>
                <th className="no-print">Xato sababi</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((q) => {
                const m = STATUS_META[q.status] ?? STATUS_META.unanswered;
                const wrong = q.status === "incorrect" || q.status === "partial";
                return (
                  <tr key={q.n}>
                    <td className="num font-semibold">{q.n}</td>
                    <td className="num">{q.type}</td>
                    <td className={cx("whitespace-nowrap font-medium", m.cls)}>
                      <span aria-hidden className="num mr-1">
                        {m.icon}
                      </span>
                      {m.label}
                      {q.pairs && <span className="num ml-1 text-xs text-muted">({q.pairs.filter(Boolean).length}/{q.pairs.length})</span>}
                    </td>
                    <td className="num">{showAnswer(q.answer)}</td>
                    {r.revealAnswers && <td className="num">{showAnswer(q.correct)}</td>}
                    <td className="text-xs text-ink-2">{q.topic ?? "—"}</td>
                    <td className="no-print">
                      {wrong ? (
                        <select aria-label={`${q.n}-savol xato sababi`} className="field !min-h-0 !py-1 text-xs" value={reasons[q.n] ?? ""} onChange={(e) => setReason(q.n, e.target.value)}>
                          <option value="">—</option>
                          {ERROR_REASONS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted">
                    Bu filtr bo‘yicha savol yo‘q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted no-print">Xato sabablari faqat shu qurilmada saqlanadi va o‘zingizning tahlilingiz uchun.</p>
      </section>

      <p className="mt-10 border-t border-hair pt-4 text-xs text-muted">
        Milliy Mock — mustaqil mock-imtihon platformasi. Ushbu hisobot rasmiy sertifikat yoki rasmiy natija emas. Format manbasi: {r.format.sourceUrl || "—"}
      </p>
    </div>
  );
}

function FileLink({ attemptId, file }: { attemptId: string; file: { id: string; name: string } }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="link"
      disabled={busy}
      onClick={async () => {
        const w = window.open("about:blank", "_blank");
        setBusy(true);
        try {
          const res = await api<{ url: string }>(`/api/attempts/${attemptId}/files/${file.id}`);
          if (w) {
            w.opener = null;
            w.location.href = res.url;
          }
        } catch {
          w?.close();
        } finally {
          setBusy(false);
        }
      }}
    >
      📎 {file.name}
    </button>
  );
}
