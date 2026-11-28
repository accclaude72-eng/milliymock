"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";

interface Data {
  code: string;
  myName: string;
  nameSet: boolean;
  isPublic: boolean;
  board: {
    id: string;
    name: string;
    xp: number;
    me: boolean;
    rank: number;
    friendshipId: string | null;
  }[];
  incoming: { id: string; name: string; at: string }[];
  outgoing: { id: string; name: string; at: string }[];
  blocked: { id: string; name: string }[];
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Friends />}</RequireCandidate>
    </Suspense>
  );
}

function Friends() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Data>("/api/me/friends")
      .then(setD)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setErr(null);
    setNote(null);
    try {
      await fn();
      if (ok) setNote(ok);
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const act = (id: string, action: "accept" | "decline" | "remove" | "block", confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    run(id + action, () => api("/api/me/friends", { method: "POST", body: { action, id } }));
  };
  const battle = (friendId: string) =>
    run("battle" + friendId, async () => {
      const r = await api<{ id: string }>("/api/battles", {
        method: "POST",
        body: { action: "create", mode: "friend", subject: "mixed", friendId },
      });
      router.push(`/battle/${r.id}`);
    });

  if (!d && !err) return <PageLoader />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Birga o‘qish qiziqroq</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Do‘stlar</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Do‘stlar bir-birini faqat shaxsiy kod orqali qo‘shadi — email yoki Candidate ID hech kimga ko‘rsatilmaydi.</p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {note && (
        <Alert tone="ok" className="mt-6">
          {note}
        </Alert>
      )}

      {d && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="sheet-hard p-5">
            <h2 className="text-lg font-semibold">Mening kodim</h2>
            <p className="num mt-2 select-all text-4xl font-semibold tracking-[0.15em]">{d.code}</p>
            <button
              type="button"
              className="btn btn-sm mt-3"
              onClick={() =>
                navigator.clipboard?.writeText(d.code).then(
                  () => setNote("Kod nusxalandi."),
                  () => undefined,
                )
              }
            >
              Nusxa olish
            </button>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = (name ?? d.myName).trim();
                run(
                  "name",
                  () =>
                    api("/api/me/leaderboard-profile", {
                      method: "PUT",
                      body: { isPublic: d.isPublic, displayName: n },
                    }),
                  "Ism saqlandi.",
                );
              }}
            >
              <label className="label" htmlFor="f-name">
                Do‘stlar va raqiblarga ko‘rinadigan ism
              </label>
              <div className="flex gap-2">
                <input id="f-name" className="field" maxLength={40} value={name ?? (d.nameSet ? d.myName : "")} placeholder={d.myName} onChange={(e) => setName(e.target.value)} />
                <button className="btn" disabled={busy === "name"}>
                  {busy === "name" && <Spinner />} Saqlash
                </button>
              </div>
              {!d.nameSet && <p className="mt-1 text-xs text-muted">Hozir “{d.myName}” deb ko‘rinasiz.</p>}
            </form>
          </section>

          <section className="sheet-hard p-5">
            <h2 className="text-lg font-semibold">Do‘st qo‘shish</h2>
            <p className="mt-1 text-sm text-muted">Do‘stingizning 8 belgili kodini kiriting.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run("req", async () => {
                  const r = await api<{ status: string }>("/api/me/friends", {
                    method: "POST",
                    body: { action: "request", code: code.trim() },
                  });
                  setCode("");
                  setNote(r.status === "accepted" ? "Endi siz do‘stsiz!" : "So‘rov yuborildi.");
                });
              }}
            >
              <input className="field num uppercase" maxLength={10} placeholder="ABCD2345" aria-label="Do‘st kodi" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ""))} />
              <button className="btn btn-primary" disabled={busy === "req" || code.length < 6}>
                {busy === "req" && <Spinner />} Yuborish
              </button>
            </form>
            {d.outgoing.length > 0 && (
              <>
                <p className="eyebrow mt-5">Yuborilgan so‘rovlar</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.outgoing.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <span>{o.name}</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(o.id, "remove")}>
                        Bekor qilish
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="sheet-hard p-5">
            <h2 className="text-lg font-semibold">Kelgan so‘rovlar</h2>
            {d.incoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Yangi so‘rov yo‘q.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {d.incoming.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <span className="flex gap-1">
                      <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act(i.id, "accept")}>
                        Qabul
                      </button>
                      <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => act(i.id, "decline")}>
                        Rad
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(i.id, "block", `${i.name} bloklansinmi? U sizga qayta so‘rov yubora olmaydi.`)}>
                        Bloklash
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {d && (
        <>
          <h2 className="display mt-10 text-3xl">Do‘stlar reytingi · shu hafta</h2>
          {d.board.length <= 1 ? (
            <div className="mt-4">
              <EmptyState title="Hali do‘stlar yo‘q">Kodingizni do‘stlaringizga yuboring — ular qo‘shilgach, bu yerda haftalik XP bo‘yicha bellashasiz.</EmptyState>
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-hair border-y border-hair">
              {d.board.map((r) => (
                <li key={r.id} className={cx("flex flex-wrap items-center gap-3 px-2 py-3", r.me && "bg-paper-2")}>
                  <span className="num w-8 text-lg font-semibold text-muted">{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.me ? `${r.name} (siz)` : r.name}</span>
                  <span className="num font-semibold">{r.xp} XP</span>
                  {!r.me && r.friendshipId && (
                    <span className="flex gap-1">
                      <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => battle(r.id)}>
                        {busy === "battle" + r.id && <Spinner />} Battle ⚔
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act(r.friendshipId!, "remove", `${r.name} do‘stlar ro‘yxatidan olib tashlansinmi?`)}>
                        Olib tashlash
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {d.blocked.length > 0 && (
            <details className="mt-6 text-sm">
              <summary className="cursor-pointer text-muted">Bloklanganlar ({d.blocked.length})</summary>
              <ul className="mt-2 space-y-1">
                {d.blocked.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    {b.name}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(b.id, "remove")}>
                      Blokdan chiqarish
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-6 text-sm">
            <Link href="/xonalar">O‘quv xonalari →</Link> · <Link href="/battle">Battle →</Link>
          </p>
        </>
      )}
    </div>
  );
}
