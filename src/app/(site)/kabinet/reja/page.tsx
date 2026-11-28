"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, ProgressBar, Spinner, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";

interface Task {
  id: number;
  plan_id: string;
  day: string;
  kind: "practice" | "mistakes" | "topic_review" | "assessment" | "mock";
  title: string;
  topic: string | null;
  target_count: number | null;
  minutes: number | null;
  status: "todo" | "done" | "skipped";
}
interface Plan {
  id: string;
  subject_code: string;
  subjectName: string;
  exam_date: string;
  target_score: number | null;
  current_estimate: number | null;
  daily_minutes: number;
  study_days: number[];
  priority_topics: string[];
  status: "active" | "paused";
  topics: { name: string; accuracy: number | null }[];
  tasks: Task[];
  stats: { total: number; done: number; missed: number; todayTotal: number; todayDone: number };
}
interface Data {
  today: string;
  streak: number;
  plans: Plan[];
}
interface Settings {
  examDate: string;
  targetScore: number | null;
  currentEstimate: number | null;
  dailyMinutes: number;
  studyDays: number[];
  priorityTopics: string[];
}

const WEEK = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]; // 0 = Sunday
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const KIND = {
  practice: ["Mashq", "◎"],
  mistakes: ["Xatolar", "✎"],
  topic_review: ["Nazariya", "📖"],
  assessment: ["Baholash", "★"],
  mock: ["Mock", "▶"],
} as const;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function taskLink(t: Task, subject: string): string | null {
  if (t.kind === "practice" || t.kind === "topic_review") return `/kabinet/mashq?mode=bank&subject=${subject}${t.topic ? `&topic=${encodeURIComponent(t.topic)}` : ""}&count=${t.target_count ?? 10}`;
  if (t.kind === "mistakes") return `/kabinet/mashq?mode=mistakes&subject=${subject}&count=${t.target_count ?? 10}`;
  if (t.kind === "assessment") return `/kabinet/mashq?mode=bank&subject=${subject}&count=${t.target_count ?? 20}`;
  return `/fanlar/${subject}`;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Plans />}</RequireCandidate>
    </Suspense>
  );
}

function SettingsForm({ subjectCode, topics, initial, busy, onSubmit, submitLabel }: { subjectCode: string; topics: string[]; initial: Settings; busy: boolean; onSubmit: (s: Settings) => void; submitLabel: string }) {
  const [s, setS] = useState(initial);
  const toggleDay = (d: number) => setS({ ...s, studyDays: s.studyDays.includes(d) ? s.studyDays.filter((x) => x !== d) : [...s.studyDays, d] });
  const toggleTopic = (t: string) => setS({ ...s, priorityTopics: s.priorityTopics.includes(t) ? s.priorityTopics.filter((x) => x !== t) : [...s.priorityTopics, t] });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(s);
      }}
    >
      <div>
        <label className="label" htmlFor={`ed-${subjectCode}`}>
          Imtihon sanasi
        </label>
        <input id={`ed-${subjectCode}`} type="date" required className="field num" value={s.examDate} onChange={(e) => setS({ ...s, examDate: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor={`dm-${subjectCode}`}>
          Kunlik vaqt (daqiqa)
        </label>
        <input id={`dm-${subjectCode}`} type="number" min={10} max={600} step={5} required className="field num" value={s.dailyMinutes} onChange={(e) => setS({ ...s, dailyMinutes: Number(e.target.value) })} />
      </div>
      <div>
        <label className="label" htmlFor={`ts-${subjectCode}`}>
          Maqsad (natija %, ixtiyoriy)
        </label>
        <input id={`ts-${subjectCode}`} type="number" min={0} max={100} className="field num" value={s.targetScore ?? ""} onChange={(e) => setS({ ...s, targetScore: e.target.value === "" ? null : Number(e.target.value) })} />
      </div>
      <div>
        <label className="label" htmlFor={`ce-${subjectCode}`}>
          Hozirgi taxminiy natija (%, ixtiyoriy)
        </label>
        <input id={`ce-${subjectCode}`} type="number" min={0} max={100} className="field num" value={s.currentEstimate ?? ""} onChange={(e) => setS({ ...s, currentEstimate: e.target.value === "" ? null : Number(e.target.value) })} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label">O‘qish kunlari</legend>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((d) => (
            <button key={d} type="button" aria-pressed={s.studyDays.includes(d)} className={cx("btn btn-sm min-w-11", s.studyDays.includes(d) && "btn-ink")} onClick={() => toggleDay(d)}>
              {WEEK[d]}
            </button>
          ))}
        </div>
      </fieldset>
      {topics.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className="label">Ustuvor mavzular (ko‘proq vaqt ajratiladi)</legend>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <button key={t} type="button" aria-pressed={s.priorityTopics.includes(t)} className={cx("btn btn-sm !whitespace-normal text-left", s.priorityTopics.includes(t) && "btn-ink")} onClick={() => toggleTopic(t)}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !s.studyDays.length}>
          {busy && <Spinner />} {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Calendar({ plan, today }: { plan: Plan; today: string }) {
  const [offset, setOffset] = useState(0);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of plan.tasks) m.set(t.day, [...(m.get(t.day) ?? []), t]);
    return m;
  }, [plan.tasks]);
  const first = new Date(Date.parse(`${today.slice(0, 7)}-01T00:00:00Z`));
  first.setUTCMonth(first.getUTCMonth() + offset);
  const month = first.toISOString().slice(0, 7);
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysIn = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOffset(offset - 1)} aria-label="Oldingi oy">
          ←
        </button>
        <p className="font-semibold">
          {MONTHS[first.getUTCMonth()]} {first.getUTCFullYear()}
        </p>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOffset(offset + 1)} aria-label="Keyingi oy">
          →
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center font-mono text-[0.6rem] text-muted">
        {ORDER.map((d) => (
          <span key={d}>{WEEK[d]}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const ts = byDay.get(day) ?? [];
          const done = ts.length > 0 && ts.every((t) => t.status !== "todo");
          const missed = day < today && ts.some((t) => t.status === "todo");
          const exam = day === plan.exam_date;
          return (
            <div
              key={day}
              title={ts.map((t) => `${t.title} (${t.status === "done" ? "bajarildi" : t.status === "skipped" ? "o‘tkazildi" : "reja"})`).join("\n") || undefined}
              className={cx(
                "flex aspect-square flex-col items-center justify-center rounded-[3px] border text-xs",
                exam ? "border-accent bg-accent text-white" : day === today ? "border-ink font-bold" : "border-hair",
                done && !exam && "bg-ok-soft",
                missed && !exam && "bg-accent-soft",
              )}
            >
              <span className="num">{Number(day.slice(8))}</span>
              {ts.length > 0 && !exam && <span className="flex gap-0.5">{ts.slice(0, 3).map((t) => <span key={t.id} className={cx("h-1 w-1 rounded-full", t.status === "done" ? "bg-ok" : "bg-ink")} />)}</span>}
              {exam && <span className="text-[0.5rem]">IMTIHON</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-3 text-[0.65rem] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 bg-ok-soft" /> bajarilgan
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 bg-accent-soft" /> o‘tkazib yuborilgan
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 bg-accent" /> imtihon
        </span>
      </p>
    </div>
  );
}

function PlanCard({ plan, today, onChanged }: { plan: Plan; today: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  // Fresh server data remounts this card (see `key` in Plans), so local state starts from it.
  const [tasks, setTasks] = useState(plan.tasks);

  const act = async (action: string, settings?: Settings) => {
    if (action === "archive" && !window.confirm("Rejani yakunlab arxivlaysizmi? Bajarilgan vazifalar saqlanadi.")) return;
    setBusy(action);
    setErr(null);
    try {
      await api(`/api/me/plans/${plan.id}`, { method: "PATCH", body: { action, settings } });
      setEdit(false);
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const setStatus = async (t: Task, status: Task["status"]) => {
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    try {
      await api(`/api/me/plan-tasks/${t.id}`, { method: "PATCH", body: { status } });
    } catch (e) {
      setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
      setErr(errorText(e));
    }
  };

  const daysLeft = daysBetween(today, plan.exam_date);
  const todays = tasks.filter((t) => t.day === today);
  const nextDay = tasks.find((t) => t.day > today)?.day;
  const upcoming = nextDay ? tasks.filter((t) => t.day === nextDay) : [];
  const missed = tasks.filter((t) => t.day < today && t.status === "todo");
  const weekEnd = addDays(today, 6);
  const week = tasks.filter((t) => t.day >= today && t.day <= weekEnd);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <section className="sheet-hard p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{plan.status === "paused" ? "To‘xtatilgan reja" : "Faol reja"}</p>
          <h2 className="display mt-1 text-3xl">{plan.subjectName}</h2>
          <p className="text-sm text-muted">
            Imtihon: {plan.exam_date} · kuniga {plan.daily_minutes} daqiqa · {ORDER.filter((d) => plan.study_days.includes(d)).map((d) => WEEK[d]).join(", ")}
            {plan.target_score != null && ` · maqsad ${plan.target_score}%`}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-5xl font-semibold text-accent">{Math.max(0, daysLeft)}</p>
          <p className="eyebrow">kun qoldi</p>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={done} max={Math.max(1, tasks.length)} tone="ok" label="Reja bajarilishi" />
        <p className="mt-1 text-xs text-muted">
          {done}/{tasks.length} vazifa bajarildi{missed.length ? ` · ${missed.length} ta o‘tkazib yuborilgan` : ""}
        </p>
      </div>
      {err && (
        <Alert tone="error" className="mt-3">
          {err}
        </Alert>
      )}
      {plan.status === "paused" && (
        <Alert tone="warn" className="mt-3">
          Reja to‘xtatilgan — kelajakdagi vazifalar o‘chirilgan. “Davom ettirish” bosilsa, bugundan boshlab qayta tuziladi.
        </Alert>
      )}
      {missed.length > 0 && plan.status === "active" && (
        <Alert tone="warn" className="mt-3" title={`${missed.length} ta vazifa o‘tkazib yuborildi`}>
          Rejani qayta tuzsangiz, qolgan vaqtga moslab yangi jadval yaratiladi (bajarilganlar saqlanadi).
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <h3 className="font-semibold">Bugungi vazifalar</h3>
          {todays.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Bugun dam olish kuni{upcoming.length ? ` — keyingi mashg‘ulot ${nextDay}` : ""}.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {todays.map((t) => {
                const href = taskLink(t, plan.subject_code);
                return (
                  <li key={t.id} className={cx("flex items-center gap-3 rounded-[3px] border p-3", t.status === "done" ? "border-ok bg-ok-soft" : "border-hair")}>
                    <input type="checkbox" className="h-5 w-5 accent-[var(--color-ok)]" checked={t.status === "done"} onChange={(e) => setStatus(t, e.target.checked ? "done" : "todo")} aria-label={`${t.title} bajarildi`} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-sm font-medium", t.status === "done" && "line-through opacity-70")}>{t.title}</span>
                      <span className="text-xs text-muted">
                        {KIND[t.kind][1]} {KIND[t.kind][0]}
                        {t.target_count ? ` · ${t.target_count} ta savol` : ""}
                        {t.minutes ? ` · ${t.minutes} daq` : ""}
                      </span>
                    </span>
                    {href && t.status !== "done" && (
                      <Link href={href} className="btn btn-sm btn-primary">
                        Boshlash
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="mt-6 font-semibold">Shu hafta</h3>
          <ul className="mt-2 divide-y divide-hair text-sm">
            {[...new Set(week.map((t) => t.day))].map((d) => {
              const ts = week.filter((t) => t.day === d);
              return (
                <li key={d} className="flex gap-3 py-2">
                  <span className="num w-20 shrink-0 text-xs text-muted">
                    {WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()]} {d.slice(5)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {ts.map((t) => (
                      <span key={t.id} className={cx("mr-2 inline-block", t.status === "done" && "text-ok line-through")}>
                        {KIND[t.kind][1]} {t.title}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
            {week.length === 0 && <li className="py-2 text-muted">Bu hafta vazifa yo‘q.</li>}
          </ul>
          {plan.topics.some((t) => t.accuracy != null) && (
            <>
              <h3 className="mt-6 font-semibold">Mavzular bo‘yicha natijangiz</h3>
              <ul className="mt-2 grid gap-1 text-xs">
                {plan.topics.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className={cx("num", t.accuracy != null && t.accuracy < 60 && "text-accent")}>{t.accuracy == null ? "ma’lumot yo‘q" : `${t.accuracy}%`}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Calendar plan={{ ...plan, tasks }} today={today} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-hair pt-4">
        <button type="button" className="btn btn-sm" onClick={() => setEdit(!edit)}>
          ✎ Tahrirlash
        </button>
        <button type="button" className="btn btn-sm" disabled={!!busy || plan.status !== "active"} onClick={() => act("regenerate")}>
          {busy === "regenerate" && <Spinner />} ↻ Qayta tuzish
        </button>
        {plan.status === "active" ? (
          <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act("pause")}>
            ⏸ To‘xtatish
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act("resume")}>
            ▶ Davom ettirish
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost text-accent-ink" disabled={!!busy} onClick={() => act("archive")}>
          Yakunlash
        </button>
      </div>
      {edit && (
        <div className="mt-4 rounded-[3px] border border-hair p-4">
          <SettingsForm
            subjectCode={plan.subject_code}
            topics={plan.topics.map((t) => t.name)}
            busy={busy === "update"}
            submitLabel="Saqlash va qayta tuzish"
            initial={{ examDate: plan.exam_date, targetScore: plan.target_score, currentEstimate: plan.current_estimate, dailyMinutes: plan.daily_minutes, studyDays: plan.study_days, priorityTopics: plan.priority_topics }}
            onSubmit={(s) => act("update", s)}
          />
        </div>
      )}
    </section>
  );
}

function Plans() {
  const { subjects } = useSubjects();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    api<Data>("/api/me/plans")
      .then((x) => {
        setD(x);
        setVersion((v) => v + 1);
      })
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const free = (subjects ?? []).filter((s) => !d?.plans.some((p) => p.subject_code === s.code));
  const chosen = (subjects ?? []).find((s) => s.code === subject);
  const create = async (s: Settings) => {
    setCreating(true);
    setErr(null);
    try {
      await api("/api/me/plans", { method: "POST", body: { ...s, subjectCode: subject } });
      setShowNew(false);
      setSubject("");
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setCreating(false);
    }
  };

  const defaultExam = d ? addDays(d.today, 60) : "";
  const todayTotal = d?.plans.reduce((s, p) => s + p.stats.todayTotal, 0) ?? 0;
  const todayDone = d?.plans.reduce((s, p) => s + p.stats.todayDone, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shaxsiy</p>
          <h1 className="display mt-1 text-4xl sm:text-5xl">O‘quv reja</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Reja natijalaringiz asosida avtomatik tuziladi: zaif mavzularga ko‘proq vaqt, har kuni xatolarni takrorlash, har 7-kunda haftalik baholash va imtihon oldidan to‘liq mocklar.
          </p>
        </div>
        {d && free.length > 0 && !showNew && (
          <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
            ＋ Yangi reja
          </button>
        )}
      </div>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {!d && !err && <PageLoader />}
      {d && (
        <>
          {d.plans.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Bugungi vazifalar" value={`${todayDone}/${todayTotal}`} tone={todayTotal > 0 && todayDone === todayTotal ? "ok" : undefined} />
              <Stat label="O‘qish streaki" value={`${d.streak} kun`} tone="accent" hint="ketma-ket vazifa bajarilgan kunlar" />
              <Stat label="Faol rejalar" value={d.plans.length} />
            </div>
          )}
          {(showNew || d.plans.length === 0) && (
            <section className="sheet mt-6 p-5">
              <h2 className="display text-2xl">Yangi reja tuzish</h2>
              <div className="mt-4 max-w-sm">
                <label className="label" htmlFor="np-s">
                  Fan
                </label>
                <select id="np-s" className="field" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Fanni tanlang…</option>
                  {free.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {chosen && (
                <div className="mt-4">
                  <SettingsForm
                    key={chosen.code}
                    subjectCode={chosen.code}
                    topics={chosen.format?.topics ?? []}
                    busy={creating}
                    submitLabel="Rejani tuzish"
                    initial={{ examDate: defaultExam, targetScore: null, currentEstimate: null, dailyMinutes: 60, studyDays: [1, 2, 3, 4, 5, 6], priorityTopics: [] }}
                    onSubmit={create}
                  />
                </div>
              )}
              {d.plans.length === 0 && !chosen && (
                <div className="mt-6">
                  <EmptyState title="Hali reja yo‘q">Fanni tanlang, imtihon sanasi va kunlik vaqtni kiriting — reja bir zumda tuziladi.</EmptyState>
                </div>
              )}
            </section>
          )}
          <div className="mt-6 space-y-6">
            {d.plans.map((p) => (
              <PlanCard key={`${p.id}:${version}`} plan={p} today={d.today} onChanged={load} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
