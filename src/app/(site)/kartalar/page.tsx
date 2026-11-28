"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, Spinner, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  subjectCode: string | null;
  source: "admin" | "student" | "mistakes";
  own: boolean;
  total: number;
  due: number;
  fresh: number;
  learned: number;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Decks />}</RequireCandidate>
    </Suspense>
  );
}

function Decks() {
  const router = useRouter();
  const { subjects } = useSubjects();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", subjectCode: "" });

  useEffect(() => {
    api<{ decks: Deck[] }>("/api/flashcards")
      .then((d) => setDecks(d.decks))
      .catch((e) => setErr(errorText(e)));
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id: string }>("/api/flashcards", { method: "POST", body: { title: f.title.trim(), description: null, subjectCode: f.subjectCode || null } });
      router.push(`/kartalar/${r.id}?tahrir=1`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };
  const subjectName = (c: string | null) => (c ? (subjects?.find((s) => s.code === c)?.name ?? c) : "Umumiy");
  const dueAll = decks?.reduce((s, d) => s + d.due, 0) ?? 0;
  const newAll = decks?.reduce((s, d) => s + d.fresh, 0) ?? 0;
  const learned = decks?.reduce((s, d) => s + d.learned, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Takrorlash — SM-2 algoritmi</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-4xl sm:text-5xl">Flashcards</h1>
        <Link href="/kartalar/oflayn" className="btn btn-sm btn-ghost">
          ⤓ Oflayn kartalar
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Kartani ko‘ring, javobni eslang, keyin qanchalik oson eslaganingizni belgilang. Oson kartalar kamroq, qiyinlari tez-tez qaytadi. “Xatolarim” to‘plami xatolar daftaringizdan avtomatik tuziladi.
      </p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      <div className="mt-6 grid grid-cols-3 gap-3 md:max-w-xl">
        <Stat label="Bugun takrorlash" value={decks ? dueAll : "…"} tone="accent" />
        <Stat label="Yangi kartalar" value={decks ? newAll : "…"} />
        <Stat label="O‘rganilgan" value={decks ? learned : "…"} tone="ok" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section>
          {!decks && !err && <PageLoader />}
          {decks && decks.length === 0 && <EmptyState title="Hali to‘plam yo‘q">O‘zingizning to‘plamingizni yarating yoki mock topshiring — xatolaringizdan “Xatolarim” to‘plami tuziladi.</EmptyState>}
          {decks && decks.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {decks.map((d) => (
                <li key={d.id}>
                  <Link href={`/kartalar/${d.id}`} className="sheet-hard flex h-full flex-col p-4 transition-transform hover:-translate-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx("chip", d.source === "mistakes" ? "chip-accent" : d.own ? "chip-ink" : "chip-info")}>
                        {d.source === "mistakes" ? "Xatolarim" : d.own ? "Mening" : "Rasmiy"}
                      </span>
                      <span className="text-xs text-muted">{subjectName(d.subjectCode)}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{d.title}</h3>
                    {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{d.description}</p>}
                    <p className="num mt-auto pt-3 text-sm">
                      <b className={d.due ? "text-accent" : ""}>{d.due}</b> takrorlash · <b>{d.fresh}</b> yangi · <span className="text-muted">{d.total} ta karta</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="sheet-hard h-fit p-5">
          <h2 className="text-lg font-semibold">Yangi to‘plam</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div>
              <label className="label" htmlFor="d-title">
                Nomi
              </label>
              <input
                id="d-title"
                className="field"
                required
                minLength={3}
                maxLength={80}
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                placeholder="Masalan: Genetika atamalari"
              />
            </div>
            <div>
              <label className="label" htmlFor="d-subj">
                Fan
              </label>
              <select id="d-subj" className="field" value={f.subjectCode} onChange={(e) => setF({ ...f, subjectCode: e.target.value })}>
                <option value="">Umumiy</option>
                {subjects?.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary w-full" disabled={busy || f.title.trim().length < 3}>
              {busy && <Spinner />} Yaratish
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
