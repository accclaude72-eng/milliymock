"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";

interface Room {
  id: string;
  name: string;
  subjectCode: string | null;
  description: string | null;
  isOwner: boolean;
  members: number;
  online: number;
  maxMembers: number;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Rooms />}</RequireCandidate>
    </Suspense>
  );
}

function Rooms() {
  const router = useRouter();
  const { subjects } = useSubjects();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [f, setF] = useState({
    name: "",
    subjectCode: "",
    description: "",
    maxMembers: 10,
  });

  useEffect(() => {
    api<{ rooms: Room[] }>("/api/rooms")
      .then((d) => setRooms(d.rooms))
      .catch((e) => setErr(errorText(e)));
  }, []);

  const go = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      const r = await api<{ id: string }>("/api/rooms", {
        method: "POST",
        body,
      });
      router.push(`/xonalar/${r.id}`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(null);
    }
  };
  const subjectName = (c: string | null) => (c ? (subjects?.find((s) => s.code === c)?.name ?? c) : "Umumiy");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Birgalikda tayyorlanish</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">O‘quv xonalari</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Kichik guruh uchun yopiq xona: umumiy pomodoro taymer, chat va kim hozir o‘qiyotgani. Xonaga faqat taklif kodi bilan kiriladi.</p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {!rooms && !err && <PageLoader />}
          {rooms && rooms.length === 0 && <EmptyState title="Hali xonangiz yo‘q">Yangi xona oching yoki do‘stingizdan taklif kodini oling.</EmptyState>}
          {rooms && rooms.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`/xonalar/${r.id}`} className="sheet-hard block p-4 transition-transform hover:-translate-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip chip-accent">{subjectName(r.subjectCode)}</span>
                      {r.isOwner && <span className="chip chip-ink">egasi</span>}
                      <span className="ml-auto text-sm">
                        <span className={r.online ? "text-ok" : "text-muted"}>●</span> {r.online} onlayn
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{r.name}</h3>
                    {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                    <p className="num mt-2 text-xs text-muted">
                      {r.members}/{r.maxMembers} a’zo
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="sheet-hard p-5">
            <h2 className="text-lg font-semibold">Kod bilan kirish</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                go("join", { action: "join", code: code.trim() });
              }}
            >
              <input className="field num uppercase" maxLength={8} placeholder="ABCD2345" aria-label="Xona kodi" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ""))} />
              <button className="btn btn-primary" disabled={!!busy || code.length !== 8}>
                {busy === "join" && <Spinner />} Kirish
              </button>
            </form>
          </section>
          <section className="sheet-hard p-5">
            <h2 className="text-lg font-semibold">Yangi xona</h2>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                go("create", {
                  action: "create",
                  name: f.name.trim(),
                  subjectCode: f.subjectCode || null,
                  description: f.description.trim() || null,
                  maxMembers: f.maxMembers,
                });
              }}
            >
              <div>
                <label className="label" htmlFor="r-name">
                  Nomi
                </label>
                <input
                  id="r-name"
                  className="field"
                  required
                  minLength={3}
                  maxLength={60}
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  placeholder="Masalan: Kimyo — kechki guruh"
                />
              </div>
              <div>
                <label className="label" htmlFor="r-subj">
                  Fan
                </label>
                <select id="r-subj" className="field" value={f.subjectCode} onChange={(e) => setF({ ...f, subjectCode: e.target.value })}>
                  <option value="">Umumiy</option>
                  {subjects?.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="r-desc">
                  Tavsif (ixtiyoriy)
                </label>
                <textarea id="r-desc" className="field" rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="r-max">
                  A’zolar soni (2–50)
                </label>
                <input
                  id="r-max"
                  type="number"
                  min={2}
                  max={50}
                  className="field num"
                  value={f.maxMembers}
                  onChange={(e) =>
                    setF({
                      ...f,
                      maxMembers: Math.min(50, Math.max(2, Number(e.target.value) || 2)),
                    })
                  }
                />
              </div>
              <button className="btn btn-primary w-full" disabled={!!busy || f.name.trim().length < 3}>
                {busy === "create" && <Spinner />} Xona ochish
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
