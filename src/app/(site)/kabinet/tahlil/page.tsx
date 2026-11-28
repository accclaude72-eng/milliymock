"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { ProgressLine, StackBar, TopicBars } from "@/components/charts";
import { RequireCandidate } from "@/components/guards";
import { Alert, EmptyState, PageLoader, Stat } from "@/components/ui";
import type { Analytics } from "@/lib/analytics";
import { api, errorText } from "@/lib/api";
import { cx, fmtDate, fmtNum } from "@/lib/format-utils";

type Data = Analytics & { pendingReview: number };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <AnalyticsView />}</RequireCandidate>
    </Suspense>
  );
}

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>;
  return <span className={cx("num font-semibold", v > 0 ? "text-ok" : v < 0 ? "text-accent" : "text-muted")}>{v > 0 ? `+${fmtNum(v)}` : fmtNum(v)}</span>;
}

/** Daily bars for 7 / 30 days: exam average (bar) + practice activity (dots). */
function DailyBars({ days }: { days: Data["last7"] }) {
  const max = Math.max(1, ...days.map((d) => d.practiced));
  return (
    <div className="flex h-44 items-end gap-1" role="img" aria-label="Kunlik faollik">
      {days.map((d) => (
        <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.exams} ta imtihon${d.avgPercent != null ? `, o‘rtacha ${d.avgPercent}%` : ""}; ${d.practiced} ta mashq javobi`}>
          <div className="w-full rounded-t-[2px] bg-hair" style={{ height: `${(d.practiced / max) * 30}%` }} />
          {d.avgPercent != null && <div className="mt-0.5 w-full rounded-t-[2px] bg-accent" style={{ height: `${d.avgPercent * 0.65}%` }} />}
          <span className="mt-1 hidden text-center font-mono text-[0.55rem] text-muted sm:block">{d.day.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsView() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30>(30);
  const [subject, setSubject] = useState<string>("all");

  useEffect(() => {
    api<Data>("/api/me/analytics")
      .then(setD)
      .catch((e) => setErr(errorText(e)));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Natijalar tahlili</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Tahlil</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Faqat e’lon qilingan imtihon natijalaringiz va mashq javoblaringiz asosida. Foizlar platformadagi <b>xom natija</b> — rasmiy sertifikat balli emas.
      </p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {!d && !err && <PageLoader />}
      {d && d.overview.exams === 0 && d.overview.practiceAnswers === 0 ? (
        <div className="mt-8">
          <EmptyState title="Hali tahlil uchun ma’lumot yo‘q" action={<Link href="/imtihonlar" className="btn btn-primary">Birinchi mockni topshirish</Link>}>
            Birinchi imtihon natijangiz e’lon qilingach bu yerda grafiklar, kuchli va zaif mavzular paydo bo‘ladi.
            {d.pendingReview > 0 && ` ${d.pendingReview} ta ishingiz ekspert tekshiruvida.`}
          </EmptyState>
        </div>
      ) : (
        d && (
          <div className="mt-8 space-y-8">
            {d.pendingReview > 0 && <Alert tone="info">{d.pendingReview} ta ishingiz hali ekspert tekshiruvida — e’lon qilingach tahlilga qo‘shiladi.</Alert>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Imtihonlar" value={d.overview.exams} hint={`${d.overview.questions} ta savol`} />
              <Stat label="O‘rtacha natija" value={d.overview.avgPercent != null ? `${fmtNum(d.overview.avgPercent)}%` : "—"} hint={d.overview.bestPercent != null ? `eng yaxshisi ${fmtNum(d.overview.bestPercent)}%` : undefined} />
              <Stat label="Aniqlik" value={d.overview.accuracy != null ? `${fmtNum(d.overview.accuracy)}%` : "—"} hint={`${d.overview.correct} to‘g‘ri · ${d.overview.incorrect} xato`} tone="ok" />
              <Stat label="Streak" value={`${d.overview.streak} kun`} hint={`${d.overview.studyMinutes} daqiqa imtihonda`} tone="accent" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <section className="sheet p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="display text-2xl">Faollik</h2>
                  <div className="flex gap-1">
                    {([7, 30] as const).map((r) => (
                      <button key={r} type="button" className={cx("btn btn-sm", range === r && "btn-ink")} onClick={() => setRange(r)}>
                        {r} kun
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <DailyBars days={range === 7 ? d.last7 : d.last30} />
                </div>
                <p className="mt-2 flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 bg-accent" /> imtihon o‘rtachasi
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 bg-hair" /> mashq javoblari
                  </span>
                </p>
              </section>
              <section className="sheet p-5">
                <h2 className="display text-2xl">Javoblar tarkibi</h2>
                <div className="mt-5">
                  <StackBar
                    parts={[
                      { label: "To‘g‘ri", value: d.overview.correct, className: "bg-ok" },
                      { label: "Noto‘g‘ri", value: d.overview.incorrect, className: "bg-accent" },
                      { label: "Javobsiz", value: d.overview.unanswered, className: "bg-hair" },
                    ]}
                  />
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="eyebrow">Bir savolga</dt>
                    <dd className="num mt-1 text-xl font-semibold">{d.overview.avgSecondsPerQuestion != null ? `${d.overview.avgSecondsPerQuestion} s` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Mashq aniqligi</dt>
                    <dd className="num mt-1 text-xl font-semibold">{d.overview.practiceAccuracy != null ? `${fmtNum(d.overview.practiceAccuracy)}%` : "—"}</dd>
                    <dd className="text-xs text-muted">{d.overview.practiceAnswers} ta javob (60 kun)</dd>
                  </div>
                </dl>
              </section>
            </div>

            {d.progression.length > 0 && (
              <section className="sheet p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="display text-2xl">Natijalar dinamikasi</h2>
                  <select className="field !min-h-9 max-w-56 !py-1 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Fan">
                    <option value="all">Barcha fanlar</option>
                    {d.subjects.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <ProgressLine points={d.progression.filter((p) => subject === "all" || p.subjectCode === subject).map((p) => ({ x: p.at, y: p.percent, label: p.title }))} />
                </div>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="sheet p-5">
                <h2 className="display text-2xl">Fanlar bo‘yicha</h2>
                {d.subjects.length ? (
                  <div className="mt-4">
                    <TopicBars rows={d.subjects.map((s) => ({ label: s.name, value: s.avgPercent ?? 0, detail: `${s.exams} ta imtihon` }))} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">Hali e’lon qilingan imtihon yo‘q.</p>
                )}
              </section>
              <section className="sheet p-5">
                <h2 className="display text-2xl">Taqqoslash</h2>
                <ul className="mt-4 space-y-4 text-sm">
                  <li className="flex items-center justify-between gap-3 border-b border-hair pb-3">
                    <span>
                      <b>Oxirgi mock</b> va oldingisi
                      {d.compare.lastMock && (
                        <span className="block text-xs text-muted">
                          {d.compare.lastMock.previous.percent}% ({fmtDate(d.compare.lastMock.previous.at)}) → {d.compare.lastMock.last.percent}% ({fmtDate(d.compare.lastMock.last.at)})
                        </span>
                      )}
                    </span>
                    <Delta v={d.compare.lastMock?.delta ?? null} />
                  </li>
                  {(
                    [
                      ["Shu hafta", "o‘tgan hafta", d.compare.week],
                      ["Shu oy", "o‘tgan oy", d.compare.month],
                    ] as const
                  ).map(([a, b, w]) => (
                    <li key={a} className="flex items-center justify-between gap-3 border-b border-hair pb-3">
                      <span>
                        <b>{a}</b> va {b}
                        <span className="block text-xs text-muted">
                          {w.current.exams} ta ({w.current.avgPercent ?? "—"}%) · {w.previous.exams} ta ({w.previous.avgPercent ?? "—"}%)
                        </span>
                      </span>
                      <Delta v={w.current.avgPercent != null && w.previous.avgPercent != null ? Math.round((w.current.avgPercent - w.previous.avgPercent) * 10) / 10 : null} />
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="sheet p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display text-2xl">Zaif mavzular</h2>
                <span className="text-xs text-muted">kamida 2 ta savol, aniqlik 60% dan past</span>
              </div>
              {d.weakTopics.length ? (
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {d.weakTopics.map((t) => (
                    <li key={`${t.subjectCode}|${t.topic}`} className="rounded-[3px] border border-hair p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate font-medium" title={t.topic}>
                          {t.topic}
                        </span>
                        <span className="num font-semibold text-accent">{fmtNum(t.accuracy)}%</span>
                      </div>
                      <p className="text-xs text-muted">
                        {d.subjects.find((s) => s.code === t.subjectCode)?.name} · {t.count} ta savol
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link className="btn btn-sm btn-primary" href={`/kabinet/mashq?mode=bank&subject=${t.subjectCode}&topic=${encodeURIComponent(t.topic)}`}>
                          Mashq qilish
                        </Link>
                        <Link className="btn btn-sm" href={`/kabinet/mashq?mode=mistakes&subject=${t.subjectCode}&topic=${encodeURIComponent(t.topic)}`}>
                          Xatolarni takrorlash
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">Zaif mavzu aniqlanmadi — yoki hali yetarli ma’lumot yo‘q.</p>
              )}
              {d.topics.length > 0 && (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-medium">Barcha mavzular ({d.topics.length})</summary>
                  <div className="mt-4">
                    <TopicBars rows={d.topics.map((t) => ({ label: t.topic, value: t.accuracy, detail: `${t.count} savol` }))} threshold={60} />
                  </div>
                </details>
              )}
            </section>
          </div>
        )
      )}
    </div>
  );
}
