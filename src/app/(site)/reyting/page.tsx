"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";

type Period = "day" | "week" | "month" | "all";
interface Row {
  id: string;
  rank: number;
  name: string;
  xp: number;
  me: boolean;
  mocks: number;
  avg: number | null;
  achievements: number;
}
interface Data {
  page: number;
  pages: number;
  total: number;
  rows: Row[];
  me: { xp: number; rankAll: number | null; rankListed: number | null; isPublic: boolean; hiddenByAdmin: boolean; displayName: string | null; history: { week_start: string; rank: number; xp: number }[] };
}

const PERIODS: [Period, string][] = [
  ["day", "Bugun"],
  ["week", "Hafta"],
  ["month", "Oy"],
  ["all", "Umumiy"],
];
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Board />}</RequireCandidate>
    </Suspense>
  );
}

function Privacy({ me, onSaved }: { me: Data["me"]; onSaved: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState(me.displayName ?? (profile ? `${profile.firstName} ${profile.lastName.slice(0, 1)}.` : ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (isPublic: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me/leaderboard-profile", { method: "PUT", body: { isPublic, displayName: name } });
      onSaved();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="sheet p-5">
      <h2 className="display text-2xl">Reytingda ko‘rinish</h2>
      <p className="mt-1 text-sm text-muted">
        Siz {me.isPublic ? <b className="text-ok">reytingda ko‘rinasiz</b> : <b>yashirinsiz</b>}. Faqat tanlagan ismingiz, XP, yutuqlar soni va mock natijalari o‘rtachasi ko‘rinadi — email va Candidate ID hech qachon ko‘rsatilmaydi.
      </p>
      {me.hiddenByAdmin && (
        <Alert tone="warn" className="mt-3">
          Profilingiz administrator tomonidan reytingdan yashirilgan.
        </Alert>
      )}
      <label className="label mt-4" htmlFor="lbname">
        Ko‘rinadigan ism
      </label>
      <input id="lbname" className="field" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      {err && (
        <Alert tone="error" className="mt-3">
          {err}
        </Alert>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {me.isPublic ? (
          <>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save(true)}>
              {busy && <Spinner />} Ismni saqlash
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => save(false)}>
              Reytingdan yashirinish
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" disabled={busy || name.trim().length < 2} onClick={() => save(true)}>
            {busy && <Spinner />} Reytingda ko‘rinish
          </button>
        )}
      </div>
    </section>
  );
}

function Board() {
  const { subjects } = useSubjects();
  const [period, setPeriod] = useState<Period>("week");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ period, page: String(page) });
    if (subject) p.set("subject", subject);
    if (query) p.set("q", query);
    api<Data>(`/api/leaderboard?${p}`)
      .then((x) => {
        setD(x);
        setErr(null);
      })
      .catch((e) => setErr(errorText(e)));
  }, [period, subject, page, query]);

  useEffect(load, [load]);
  // Live: refresh every 30 s while the tab is visible (no websocket needed for a ranking).
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">XP bo‘yicha</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Reyting</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">XP faqat serverda tasdiqlangan natijalardan beriladi: kunlik challenge, e’lon qilingan mocklar va streak bonuslari. Har 30 soniyada yangilanadi.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {PERIODS.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={cx("btn btn-sm", period === k && "btn-ink")}
                  onClick={() => {
                    setPeriod(k);
                    setPage(1);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              className="field !min-h-9 max-w-44 !py-1 text-sm"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setPage(1);
              }}
              aria-label="Fan"
            >
              <option value="">Barcha fanlar</option>
              {(subjects ?? []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q.trim());
                setPage(1);
              }}
            >
              <input type="search" className="field !min-h-9 max-w-44 !py-1 text-sm" placeholder="Ism bo‘yicha…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
            </form>
          </div>
          {err && (
            <Alert tone="error" className="mt-4">
              {err}
            </Alert>
          )}
          {!d && !err && <PageLoader />}
          {d && d.rows.length === 0 && (
            <div className="mt-4">
              <EmptyState title="Reyting hozircha bo‘sh">Bu davrda reytingda ko‘rinishni tanlagan va XP to‘plagan nomzod yo‘q. Birinchi bo‘ling — kunlik challenge’ni yeching!</EmptyState>
            </div>
          )}
          {d && d.rows.length > 0 && (
            <div className="sheet mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nomzod</th>
                    <th className="text-right">XP</th>
                    <th className="hidden text-right sm:table-cell">Mocklar</th>
                    <th className="hidden text-right sm:table-cell">O‘rtacha</th>
                    <th className="hidden text-right md:table-cell">Yutuqlar</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.id} className={cx(r.me && "bg-accent-soft/60")}>
                      <td className="num font-semibold">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</td>
                      <td>
                        <Link href={`/reyting/${r.id}`} className="flex items-center gap-2 hover:text-accent">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper" aria-hidden>
                            {r.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 truncate font-medium">
                            {r.name}
                            {r.me && <span className="ml-1 text-xs text-accent">(siz)</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="num text-right font-semibold">{r.xp}</td>
                      <td className="num hidden text-right sm:table-cell">{r.mocks}</td>
                      <td className="num hidden text-right sm:table-cell">{r.avg != null ? `${r.avg}%` : "—"}</td>
                      <td className="num hidden text-right md:table-cell">{r.achievements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {d && d.pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ←
              </button>
              <span className="num text-sm">
                {page}/{d.pages}
              </span>
              <button type="button" className="btn btn-sm" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>
                →
              </button>
            </div>
          )}
        </section>

        {d && (
          <aside className="space-y-6">
            <section className="sheet-hard p-5">
              <p className="eyebrow">Sizning o‘rningiz</p>
              <p className="num mt-2 text-5xl font-semibold">{d.me.rankAll ?? "—"}</p>
              <p className="text-sm text-muted">
                {d.me.xp} XP · {PERIODS.find((p) => p[0] === period)?.[1].toLowerCase()}
                {!d.me.isPublic && " · faqat sizga ko‘rinadi"}
              </p>
              {d.me.history.length > 1 && (
                <>
                  <p className="eyebrow mt-4">Haftalik o‘rin tarixi</p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {d.me.history.map((h) => (
                      <li key={h.week_start} className="chip chip-ink" title={`${h.week_start}: ${h.xp} XP`}>
                        {h.week_start.slice(5)} · #{h.rank}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link href="/challenge" className="btn btn-primary mt-4 w-full">
                XP to‘plash →
              </Link>
            </section>
            <Privacy key={`${d.me.isPublic}:${d.me.displayName}`} me={d.me} onSaved={load} />
          </aside>
        )}
      </div>
    </div>
  );
}
