"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, Spinner, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx, fmtDate } from "@/lib/format-utils";

interface Challenge {
  id: string;
  subjectCode: string;
  title: string;
  difficulty: number | null;
  questions: number;
  timeLimitSec: number;
  oneAttempt: boolean;
  xp: number;
  participants: number;
  openAttemptId: string | null;
  result: { attemptId: string; percent: number; correct: number; total: number; status: string } | null;
  canStart: boolean;
}
interface Game {
  totalXp: number;
  weekXp: number;
  streak: number;
  achievements: { code: string; title: string; description: string; icon: string; earnedAt: string | null }[];
  history: { id: string; status: string; percent: number; correct: number; total: number; durationMs: number; submittedAt: string; title: string; day: string }[];
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Hub />}</RequireCandidate>
    </Suspense>
  );
}

function Hub() {
  const router = useRouter();
  const { subjects } = useSubjects();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ challenges: Challenge[] }>("/api/challenges")
      .then((d) => setList(d.challenges))
      .catch((e) => setErr(errorText(e)));
    api<Game>("/api/me/gamification")
      .then(setGame)
      .catch(() => undefined);
  }, []);

  const start = async (c: Challenge) => {
    if (c.openAttemptId) return router.push(`/challenge/${c.openAttemptId}`);
    setBusy(c.id);
    setErr(null);
    try {
      const r = await api<{ attemptId: string }>(`/api/challenges/${c.id}/start`, { method: "POST" });
      router.push(`/challenge/${r.attemptId}`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(null);
    }
  };
  const subjectName = (code: string) => (code === "mixed" ? "Aralash fanlar" : (subjects?.find((s) => s.code === code)?.name ?? code));
  const earned = game?.achievements.filter((a) => a.earnedAt).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Har kuni yangi</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Kunlik challenge</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Har kuni javoblari ochiq haqiqiy savollardan yangi to‘plam. Savollar va variantlar har bir nomzod uchun alohida aralashtiriladi, natija va XP serverda hisoblanadi.
      </p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Jami XP" value={game ? game.totalXp : "…"} tone="accent" />
        <Stat label="Shu hafta" value={game ? `+${game.weekXp}` : "…"} />
        <Stat label="Challenge streak" value={game ? `${game.streak} kun` : "…"} tone="ok" hint="har 7-kunda bonus XP" />
        <Stat label="Yutuqlar" value={game ? `${earned}/${game.achievements.length}` : "…"} />
      </div>

      <h2 className="display mt-10 text-3xl">Bugun</h2>
      {!list && !err && <PageLoader />}
      {list && list.length === 0 && (
        <div className="mt-4">
          <EmptyState title="Bugun challenge yo‘q">Savollar bazasida javoblari ochiq savollar yetarli emas. Administrator testlar qo‘shgach challenge paydo bo‘ladi.</EmptyState>
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className="sheet-hard flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-accent">{subjectName(c.subjectCode)}</span>
                {c.difficulty && <span className="chip chip-ink">qiyinlik {c.difficulty}/5</span>}
                {c.oneAttempt && <span className="chip chip-info">1 urinish</span>}
                <span className="chip chip-warn ml-auto">+{c.xp} XP</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{c.title}</h3>
              <p className="num mt-1 text-sm text-muted">
                {c.questions} savol · {Math.round(c.timeLimitSec / 60)} daqiqa · {c.participants} kishi yechdi
              </p>
              <p className="mt-2 text-xs text-muted">≥ 70% → +10 XP bonus · ≥ 90% → +20 XP bonus</p>
              <div className="mt-auto pt-4">
                {c.result ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>
                      <span className="num text-3xl font-semibold">{c.result.percent}%</span>{" "}
                      <span className="text-sm text-muted">
                        {c.result.correct}/{c.result.total} to‘g‘ri{c.result.status === "expired" ? " · vaqt tugagan" : ""}
                      </span>
                    </p>
                    <span className="flex gap-2">
                      <Link href={`/challenge/${c.result.attemptId}`} className="btn btn-sm">
                        Natijani ko‘rish
                      </Link>
                      {c.canStart && (
                        <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => start(c)}>
                          Qayta urinish
                        </button>
                      )}
                    </span>
                  </div>
                ) : (
                  <button type="button" className="btn btn-primary w-full" disabled={!!busy || (!c.canStart && !c.openAttemptId)} onClick={() => start(c)}>
                    {busy === c.id && <Spinner />} {c.openAttemptId ? "Davom ettirish →" : "Boshlash →"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {game && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="sheet p-5">
            <h2 className="display text-2xl">Yutuqlar</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {game.achievements.map((a) => (
                <li key={a.code} title={a.description} className={cx("rounded-[3px] border p-3 text-center", a.earnedAt ? "border-ink bg-card" : "border-dashed border-hair opacity-50 grayscale")}>
                  <p className="text-3xl" aria-hidden>
                    {a.icon}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{a.title}</p>
                  <p className="text-[0.68rem] text-muted">{a.earnedAt ? fmtDate(Date.parse(a.earnedAt)) : a.description}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="sheet p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-2xl">Tarix</h2>
              <Link href="/reyting" className="link text-sm">
                Reyting →
              </Link>
            </div>
            {game.history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Hali challenge yechilmagan.</p>
            ) : (
              <ul className="mt-3 divide-y divide-hair">
                {game.history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/challenge/${h.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                      <span className="min-w-0">
                        <span className="block truncate">{h.title}</span>
                        <span className="text-xs text-muted">{h.day}</span>
                      </span>
                      <span className="num shrink-0 font-semibold">
                        {h.percent}% <span className="text-xs font-normal text-muted">{h.correct}/{h.total}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
