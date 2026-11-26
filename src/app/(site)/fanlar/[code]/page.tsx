"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { TaskBar } from "@/components/landing/subjects-grid";
import { MaterialCard } from "@/components/material-card";
import { Alert, EmptyState, PageLoader } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { type ExamFormat, type SubjectInfo, TASK_TYPE_LABEL } from "@/lib/formats";
import { cx, fmtDate, fmtNum } from "@/lib/format-utils";
import { MODE_LABEL, type MaterialMode, type PublicMaterial } from "@/lib/types";

interface Data {
  subject: SubjectInfo;
  format: ExamFormat | null;
  materials: PublicMaterial[];
  topicCounts: Record<string, number>;
}
interface MyAttempt {
  id: string;
  subjectCode: string;
  materialTitle: string;
  status: string;
  createdAt: number;
  summary: { percent: number } | null;
}

const TABS: MaterialMode[] = ["full", "practice", "diagnostic"];

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SubjectPage />
    </Suspense>
  );
}

function SubjectPage() {
  const { code } = useParams<{ code: string }>();
  const { user, profile } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<MaterialMode | "mine">("full");
  const [mine, setMine] = useState<MyAttempt[] | null>(null);

  useEffect(() => {
    api<Data>(`/api/subjects/${encodeURIComponent(code)}`, { auth: false })
      .then(setData)
      .catch((e) => setErr(errorText(e)));
  }, [code]);

  useEffect(() => {
    if (tab !== "mine" || !user || !profile || mine) return;
    api<MyAttempt[]>("/api/me/attempts")
      .then((all) => setMine(all.filter((a) => a.subjectCode === code)))
      .catch(() => setMine([]));
  }, [tab, user, profile, mine, code]);

  if (err)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title="Fan ma’lumotlarini yuklab bo‘lmadi">
          {err} <Link href="/fanlar">Fanlar ro‘yxati</Link>
        </Alert>
      </div>
    );
  if (!data) return <PageLoader />;
  const { subject, format, materials, topicCounts } = data;
  const list = tab === "mine" ? [] : materials.filter((m) => m.mode === tab);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <nav aria-label="Yo‘l" className="font-mono text-xs text-muted">
        <Link href="/fanlar" className="hover:text-ink">
          Fanlar
        </Link>{" "}
        / <span className="text-ink">{subject.name}</span>
      </nav>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="display text-6xl sm:text-7xl">{subject.name}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">{subject.description}</p>
          {format && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="chip chip-ink">Faol format: {format.label}</span>
              {format.sourceUrl && (
                <a href={format.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
                  Rasmiy spetsifikatsiya ↗
                </a>
              )}
            </p>
          )}
        </div>
        {format && (
          <aside className="crop sheet-hard p-5">
            <p className="eyebrow">Imtihon formati · versiya {format.version}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-b border-hair pb-4">
              <div>
                <p className="num text-4xl font-semibold">{format.totalTasks}</p>
                <p className="text-xs text-muted">topshiriq</p>
              </div>
              <div>
                <p className="num text-4xl font-semibold">{format.totalMinutes}</p>
                <p className="text-xs text-muted">daqiqa jami</p>
              </div>
            </div>
            <div className="mt-4">
              <TaskBar format={format} />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {format.sections.map((s, i) => (
                <li key={s.id} className="flex justify-between gap-3 border-t border-hair pt-2">
                  <span>
                    <span className="num mr-2 text-xs text-accent">{i + 1}</span>
                    {s.title} <span className="num text-xs text-muted">({s.from}–{s.to})</span>
                  </span>
                  <span className="num font-semibold">{s.minutes} daq.</span>
                </li>
              ))}
            </ul>
            {format.o2Tasks.length > 0 && (
              <p className="mt-3 border-t border-hair pt-2 text-sm">
                <span className="font-semibold">O2 maksimal ballari:</span>{" "}
                <span className="num">{format.o2Tasks.map((t) => `${t.number} — ${t.maxScore}`).join(" · ")}</span>{" "}
                <span className="text-muted">(jami {format.o2Tasks.reduce((s, t) => s + t.maxScore, 0)})</span>
              </p>
            )}
            <p className="mt-3 border-t border-hair pt-2 text-xs leading-relaxed text-muted">{format.assessmentNote}</p>
          </aside>
        )}
      </div>

      {format && (
        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="display text-3xl">Topshiriq turlari</h2>
            <ul className="mt-4 space-y-2">
              {format.taskGroups.map((g) => (
                <li key={g.type + g.from} className="flex items-baseline gap-3 border-b border-hair pb-2 text-sm">
                  <span className="num w-10 font-semibold text-accent">{g.type}</span>
                  <span className="flex-1">{TASK_TYPE_LABEL[g.type]}</span>
                  <span className="num text-muted">
                    {g.from}–{g.to}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="display text-3xl">Bo‘limlar va mavzular</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {format.topics.map((t, i) => (
                <li key={t} className="sheet flex gap-3 p-3 text-sm">
                  <span className="num text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{t}</span>
                  <span className="num shrink-0 text-xs text-muted" title="E’lon qilingan variantlardagi savollar soni">
                    {topicCounts[t] ?? 0} ta
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-14">
        <div className="flex flex-wrap gap-2 border-b-[1.5px] border-ink pb-3" role="tablist" aria-label="Imtihon turlari">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cx("btn btn-sm", tab === t ? "btn-ink" : "btn-ghost")}>
              {MODE_LABEL[t]} <span className="num text-xs opacity-70">{materials.filter((m) => m.mode === t).length}</span>
            </button>
          ))}
          <button role="tab" aria-selected={tab === "mine"} type="button" onClick={() => setTab("mine")} className={cx("btn btn-sm", tab === "mine" ? "btn-ink" : "btn-ghost")}>
            Mening natijalarim
          </button>
        </div>
        <div className="mt-6" role="tabpanel">
          {tab === "mine" ? (
            !user ? (
              <EmptyState title="Natijalarni ko‘rish uchun kiring" action={<Link href={`/kirish?keyin=/fanlar/${code}`} className="btn btn-primary">Kirish</Link>} />
            ) : !mine ? (
              <PageLoader />
            ) : mine.length === 0 ? (
              <EmptyState title="Bu fandan hali urinish yo‘q">Birinchi mock imtihonni topshirgach, natijalaringiz shu yerda chiqadi.</EmptyState>
            ) : (
              <div className="sheet overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sana</th>
                      <th>Variant</th>
                      <th>Holat</th>
                      <th className="text-right">Xom natija</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((a) => (
                      <tr key={a.id}>
                        <td className="num whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                        <td>{a.materialTitle}</td>
                        <td>{a.status === "in_progress" ? <span className="chip chip-warn">Jarayonda</span> : <span className="chip chip-ink">Yakunlangan</span>}</td>
                        <td className="num text-right">{a.summary ? `${fmtNum(a.summary.percent)}%` : "—"}</td>
                        <td className="text-right">
                          <Link className="link text-sm" href={a.status === "in_progress" ? `/urinish/${a.id}` : `/natija/${a.id}`}>
                            {a.status === "in_progress" ? "Davom etish" : "Natija"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : list.length === 0 ? (
            <EmptyState title="Bu turdagi variant hali e’lon qilinmagan">Administrator yangi variant yuklagach, u shu yerda paydo bo‘ladi.</EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m, i) => (
                <MaterialCard key={m.id} m={m} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
