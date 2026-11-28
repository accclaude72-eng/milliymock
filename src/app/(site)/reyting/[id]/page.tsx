"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { Alert, PageLoader, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/lib/format-utils";

interface Profile {
  name: string;
  xp: number;
  mocks: number;
  avg: number | null;
  achievements: { code: string; title: string; description: string; icon: string; earnedAt: string }[];
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Card />}</RequireCandidate>
    </Suspense>
  );
}

function Card() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<Profile>(`/api/leaderboard/profile/${id}`)
      .then(setP)
      .catch((e) => setErr(errorText(e)));
  }, [id]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/reyting" className="link text-sm">
        ← Reyting
      </Link>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {!p && !err && <PageLoader />}
      {p && (
        <>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-2xl font-semibold text-paper" aria-hidden>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <h1 className="display text-4xl">{p.name}</h1>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="XP" value={p.xp} tone="accent" />
            <Stat label="Mocklar" value={p.mocks} />
            <Stat label="O‘rtacha" value={p.avg != null ? `${p.avg}%` : "—"} />
          </div>
          <h2 className="display mt-8 text-2xl">Yutuqlar</h2>
          {p.achievements.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Hali yutuq yo‘q.</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {p.achievements.map((a) => (
                <li key={a.code} className="sheet p-3 text-center" title={a.description}>
                  <p className="text-3xl">{a.icon}</p>
                  <p className="mt-1 text-sm font-semibold">{a.title}</p>
                  <p className="text-[0.68rem] text-muted">{fmtDate(Date.parse(a.earnedAt))}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
