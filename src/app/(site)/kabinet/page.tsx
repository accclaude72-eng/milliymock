"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ProgressLine, TopicBars } from "@/components/charts";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { TodayPanel } from "@/components/today-panel";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtDuration, fmtNum } from "@/lib/format-utils";
import type { RawSummary } from "@/lib/grading";
import { ATTEMPT_STATUS_LABEL, type AttemptStatus, type Profile, type PublicMaterial } from "@/lib/types";

export interface AttemptRow {
  id: string;
  materialId: string;
  materialTitle: string;
  subjectCode: string;
  subjectName: string;
  mode: string;
  status: AttemptStatus;
  createdAt: number;
  submittedAt: number | null;
  deadline: number | null;
  timeSpentMs: number;
  totalTasks: number;
  summary: RawSummary | null;
  hasO2: boolean;
  o2Total: number | null;
  o2Max: number;
}

export default function Page() {
  return <RequireCandidate>{(p) => <Dashboard profile={p} />}</RequireCandidate>;
}

function statusChip(s: AttemptStatus) {
  const tone = s === "published" ? "chip-ok" : s === "in_progress" ? "chip-warn" : s === "pending_review" ? "chip-info" : "chip-ink";
  return <span className={`chip ${tone}`}>{ATTEMPT_STATUS_LABEL[s]}</span>;
}

function Dashboard({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<AttemptRow[]>("/api/me/attempts")
      .then(setAttempts)
      .catch((e) => setErr(errorText(e)));
    api<PublicMaterial[]>("/api/materials", { auth: false })
      .then(setMaterials)
      .catch(() => setMaterials([]));
  }, []);

  const finished = useMemo(() => (attempts ?? []).filter((a) => a.status !== "in_progress" && a.summary), [attempts]);
  const inProgress = useMemo(() => (attempts ?? []).filter((a) => a.status === "in_progress"), [attempts]);
  const latest = finished[0];

  const weakTopics = useMemo(() => {
    const agg = new Map<string, { score: number; max: number; subject: string }>();
    for (const a of finished)
      for (const [t, b] of Object.entries(a.summary?.byTopic ?? {})) {
        const x = agg.get(t) ?? { score: 0, max: 0, subject: a.subjectCode };
        x.score += b.score;
        x.max += b.max;
        agg.set(t, x);
      }
    return Array.from(agg.entries())
      .filter(([, v]) => v.max > 0)
      .map(([label, v]) => ({ label, value: (v.score / v.max) * 100, subject: v.subject, detail: `${v.score}/${v.max}` }))
      .sort((a, b) => a.value - b.value);
  }, [finished]);

  const byType = useMemo(() => {
    const agg = new Map<string, { score: number; max: number }>();
    for (const a of finished)
      for (const [t, b] of Object.entries(a.summary?.byType ?? {})) {
        const x = agg.get(t) ?? { score: 0, max: 0 };
        x.score += b.score;
        x.max += b.max;
        agg.set(t, x);
      }
    return Array.from(agg.entries()).map(([label, v]) => ({ label, value: v.max ? (v.score / v.max) * 100 : 0, detail: `${v.score}/${v.max}` }));
  }, [finished]);

  const recommendations = useMemo(() => {
    const weakSubjects = new Set(weakTopics.filter((t) => t.value < 60).map((t) => t.subject));
    const done = new Set((attempts ?? []).map((a) => a.materialId));
    return materials.filter((m) => m.mode !== "full" && weakSubjects.has(m.subjectCode) && !done.has(m.id)).slice(0, 3);
  }, [weakTopics, materials, attempts]);

  const avg = finished.length ? finished.reduce((s, a) => s + (a.summary?.percent ?? 0), 0) / finished.length : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <CabinetNav />
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b-[1.5px] border-ink pb-8">
        <div>
          <p className="eyebrow">Shaxsiy kabinet</p>
          <h1 className="display mt-2 text-5xl sm:text-6xl">
            Assalomu alaykum, <em>{profile.firstName}</em>
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
            <span className="chip chip-ink num !text-[0.75rem] !tracking-[0.12em]">{profile.candidateId}</span>
            {profile.region && <span>{profile.region}</span>}
            <Link href="/kabinet/profil" className="link">
              Profilni tahrirlash
            </Link>
          </p>
        </div>
        <Link href="/imtihonlar" className="btn btn-primary !min-h-12 !px-6 !text-base">
          Mock imtihonni boshlash →
        </Link>
      </div>

      {user && !user.emailVerified && (
        <Alert tone="warn" className="mt-6" title="Email manzilingizni tasdiqlang">
          Natijalar haqida xabarlar va parolni tiklash uchun emailingiz tasdiqlangan bo‘lishi kerak. <Link href="/kabinet/profil">Xatni qayta yuborish</Link>
        </Alert>
      )}

      {inProgress.length > 0 && (
        <div className="mt-6 space-y-2">
          {inProgress.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-warn bg-warn-soft px-4 py-3">
              <p className="text-sm">
                <span className="font-semibold">Tugallanmagan imtihon:</span> {a.materialTitle}
                {a.deadline && <span className="num ml-2 text-xs text-ink-2">· bosqich tugashi {fmtDateTime(a.deadline)}</span>}
              </p>
              <Link href={`/urinish/${a.id}`} className="btn btn-ink btn-sm">
                Davom etish →
              </Link>
            </div>
          ))}
        </div>
      )}

      {err && (
        <Alert tone="error" className="mt-6" title="Natijalarni yuklab bo‘lmadi">
          {err}
        </Alert>
      )}

      <TodayPanel />

      {/* stats */}
      <h2 className="display mt-12 text-3xl">Mock natijalari</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Yakunlangan mock" value={attempts ? finished.length : "…"} />
        <Stat label="Oxirgi xom natija" value={latest?.summary ? `${fmtNum(latest.summary.percent)}%` : "—"} hint={latest ? `${latest.subjectName} · ${fmtDate(latest.createdAt)}` : "Hali natija yo‘q"} tone="accent" />
        <Stat label="O‘rtacha xom natija" value={avg !== null ? `${fmtNum(avg)}%` : "—"} hint={finished.length ? `${finished.length} ta urinish asosida` : undefined} />
        <Stat
          label="Tekshiruvda"
          value={attempts ? (attempts ?? []).filter((a) => a.status === "pending_review" || a.status === "graded").length : "…"}
          hint="Ekspert baholashini kutayotgan ishlar"
        />
      </div>

      {attempts && finished.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Birinchi mock imtihoningizni topshiring"
            action={
              <Link href="/imtihonlar" className="btn btn-primary">
                Imtihonlar katalogi
              </Link>
            }
          >
            Natijalar, mavzular bo‘yicha tahlil va o‘sish grafigi faqat haqiqiy urinishlaringiz asosida hisoblanadi — shuning uchun hozircha bu yer bo‘sh.
          </EmptyState>
        </div>
      ) : (
        finished.length > 0 && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="sheet p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="display text-2xl">O‘sish dinamikasi</h2>
                <span className="eyebrow">oxirgi {Math.min(10, finished.length)} ta · xom %</span>
              </div>
              <div className="mt-4">
                <ProgressLine
                  points={finished
                    .slice(0, 10)
                    .reverse()
                    .map((a) => ({ x: a.createdAt, y: a.summary?.percent ?? 0, label: `${a.subjectName}, ${fmtDate(a.createdAt)}` }))}
                />
              </div>
            </section>
            <section className="sheet p-5">
              <h2 className="display text-2xl">Topshiriq turlari</h2>
              <p className="eyebrow mt-1">barcha urinishlar bo‘yicha</p>
              <div className="mt-5">
                <TopicBars rows={byType} />
              </div>
            </section>
          </div>
        )
      )}

      {weakTopics.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="sheet p-5">
            <h2 className="display text-2xl">Zaif mavzular</h2>
            <p className="eyebrow mt-1">eng past natijadan boshlab</p>
            <div className="mt-5">
              <TopicBars rows={weakTopics.slice(0, 6)} />
            </div>
          </section>
          <section className="sheet p-5">
            <h2 className="display text-2xl">Tavsiya etiladigan mashqlar</h2>
            {recommendations.length ? (
              <ul className="mt-4 space-y-2">
                {recommendations.map((m) => (
                  <li key={m.id}>
                    <Link href={`/imtihon/${m.id}`} className="flex items-center justify-between gap-3 border border-hair p-3 transition-colors hover:border-ink">
                      <span>
                        <span className="eyebrow block">{m.subjectName}</span>
                        <span className="font-medium">{m.title}</span>
                      </span>
                      <span aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-2">
                Zaif mavzularingiz bo‘yicha yangi mashq varianti hozircha yo‘q.{" "}
                {weakTopics[0] && (
                  <Link className="link" href={`/fanlar/${weakTopics[0].subject}`}>
                    Fan sahifasiga o‘tish
                  </Link>
                )}
              </p>
            )}
          </section>
        </div>
      )}

      {/* subjects progress */}
      <section className="mt-12">
        <h2 className="display text-3xl">Fanlar</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(subjects ?? []).map((s) => {
            const mine = finished.filter((a) => a.subjectCode === s.code);
            const last = mine[0]?.summary?.percent ?? null;
            return (
              <Link key={s.code} href={`/fanlar/${s.code}`} className="sheet group flex flex-col p-4 transition-all hover:shadow-hard">
                <div className="flex items-baseline justify-between">
                  <h3 className="display text-2xl group-hover:italic">{s.name}</h3>
                  <span className="num text-xs text-muted">{mine.length} ta</span>
                </div>
                <p className="mt-1 font-mono text-[0.68rem] text-muted">{s.format?.label ?? "—"}</p>
                <div className="mt-auto pt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted">Oxirgi natija</span>
                    <span className="num font-semibold">{last !== null ? `${fmtNum(last)}%` : "—"}</span>
                  </div>
                  <ProgressBar value={last ?? 0} label={`${s.name} oxirgi natija`} tone={last !== null && last < 50 ? "accent" : "ink"} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* history */}
      <section className="mt-12">
        <h2 className="display text-3xl">Natijalar tarixi</h2>
        {!attempts ? (
          <div className="skeleton mt-5 h-40" />
        ) : attempts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Hali urinishlar yo‘q.</p>
        ) : (
          <div className="sheet mt-5 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Fan</th>
                  <th>Variant</th>
                  <th>Holat</th>
                  <th className="text-right">Xom natija</th>
                  <th className="text-right">O2</th>
                  <th className="text-right">Vaqt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="num whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                    <td>{a.subjectName}</td>
                    <td className="min-w-48">{a.materialTitle}</td>
                    <td>{statusChip(a.status)}</td>
                    <td className="num text-right">{a.summary ? `${a.summary.score}/${a.summary.max} · ${fmtNum(a.summary.percent)}%` : "—"}</td>
                    <td className="num text-right">{!a.hasO2 ? "—" : a.o2Total !== null ? `${fmtNum(a.o2Total)}/${a.o2Max}` : "kutilmoqda"}</td>
                    <td className="num whitespace-nowrap text-right">{fmtDuration(a.timeSpentMs)}</td>
                    <td className="text-right">
                      <Link className="link whitespace-nowrap text-sm" href={a.status === "in_progress" ? `/urinish/${a.id}` : `/natija/${a.id}`}>
                        {a.status === "in_progress" ? "Davom etish" : "Batafsil"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
