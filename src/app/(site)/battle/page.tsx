"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, Spinner, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { BATTLE_COUNT, BATTLE_SEC_PER_Q, BATTLE_XP } from "@/lib/battle";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Mine {
  record: { wins: number; losses: number; draws: number };
  history: {
    id: string;
    status: string;
    mode: string;
    subjectCode: string;
    createdAt: string;
    opponent: string | null;
    myCorrect: number | null;
    oppCorrect: number | null;
    total: number;
    outcome: "win" | "loss" | "draw" | null;
  }[];
  invites: {
    id: string;
    subjectCode: string;
    from: string;
    createdAt: string;
  }[];
}
interface Friends {
  board: { id: string; name: string; me: boolean }[];
}

const OUTCOME = {
  win: { t: "G‘alaba", c: "chip-ok" },
  loss: { t: "Mag‘lubiyat", c: "chip-accent" },
  draw: { t: "Durang", c: "chip-ink" },
} as const;
const STATUS: Record<string, string> = {
  waiting: "kutilmoqda",
  active: "davom etmoqda",
  cancelled: "bekor qilingan",
  expired: "hech kim qo‘shilmadi",
};

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
  const [mine, setMine] = useState<Mine | null>(null);
  const [friends, setFriends] = useState<Friends["board"]>([]);
  const [subject, setSubject] = useState("mixed");
  const [friendId, setFriendId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Mine>("/api/battles")
      .then(setMine)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(() => {
    load();
    api<Friends>("/api/me/friends")
      .then((d) => setFriends(d.board.filter((b) => !b.me)))
      .catch(() => undefined);
  }, [load]);

  const go = async (key: string, body: Record<string, unknown>, path = "/api/battles") => {
    setBusy(key);
    setErr(null);
    try {
      const r = await api<{ id: string }>(path, { method: "POST", body });
      router.push(`/battle/${r.id}`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(null);
    }
  };
  const subjectName = (c: string) => (c === "mixed" ? "Aralash fanlar" : (subjects?.find((s) => s.code === c)?.name ?? c));
  const r = mine?.record;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Jonli bellashuv</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">1v1 Battle</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Ikki nomzod bir xil {BATTLE_COUNT} ta haqiqiy savolni bir vaqtda yechadi (har savolga ~{BATTLE_SEC_PER_Q} soniya). Ko‘proq to‘g‘ri javob bergan yutadi, teng bo‘lsa — tezroq tugatgan. Raqibning
        javoblari ko‘rinmaydi, faqat qaysi savolda ekani.
      </p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 md:max-w-xl">
        <Stat label="G‘alaba" value={r ? r.wins : "…"} tone="ok" />
        <Stat label="Mag‘lubiyat" value={r ? r.losses : "…"} />
        <Stat label="Durang" value={r ? r.draws : "…"} />
      </div>

      {mine && mine.invites.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Takliflar">
          {mine.invites.map((i) => (
            <div key={i.id} className="sheet-hard flex flex-wrap items-center justify-between gap-3 border-accent p-4">
              <p>
                <b>{i.from}</b> sizni battle’ga chaqirdi · <span className="text-muted">{subjectName(i.subjectCode)}</span>
              </p>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!!busy}
                  onClick={() =>
                    api(`/api/battles/${i.id}`, {
                      method: "POST",
                      body: { action: "cancel" },
                    }).then(load, (e) => setErr(errorText(e)))
                  }
                >
                  Rad etish
                </button>
                <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => go(i.id, { action: "join" }, `/api/battles/${i.id}`)}>
                  {busy === i.id && <Spinner />} Qabul qilish
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="sheet-hard flex flex-col p-5">
          <h2 className="text-xl font-semibold">Tasodifiy raqib</h2>
          <p className="mt-1 text-sm text-muted">Shu fanni tanlagan, hozir navbatda turgan nomzod bilan.</p>
          <label className="label mt-4" htmlFor="b-subj">
            Fan
          </label>
          <select id="b-subj" className="field" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="mixed">Aralash fanlar</option>
            {subjects?.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary mt-auto w-full" style={{ marginTop: "1rem" }} disabled={!!busy} onClick={() => go("random", { action: "create", mode: "random", subject })}>
            {busy === "random" && <Spinner />} Raqib izlash ⚔
          </button>
        </section>

        <section className="sheet-hard flex flex-col p-5">
          <h2 className="text-xl font-semibold">Do‘st bilan</h2>
          {friends.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              Hali do‘stlaringiz yo‘q. <Link href="/dostlar">Do‘st qo‘shish →</Link>
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">Do‘stingizga taklif boradi, u “Battle” sahifasida qabul qiladi.</p>
              <label className="label mt-4" htmlFor="b-friend">
                Do‘st
              </label>
              <select id="b-friend" className="field" value={friendId} onChange={(e) => setFriendId(e.target.value)}>
                <option value="">Tanlang…</option>
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className="btn mt-auto w-full"
            style={{ marginTop: "1rem" }}
            disabled={!!busy || !friendId}
            onClick={() =>
              go("friend", {
                action: "create",
                mode: "friend",
                subject,
                friendId,
              })
            }
          >
            {busy === "friend" && <Spinner />} Chaqirish
          </button>
        </section>

        <section className="sheet-hard flex flex-col p-5">
          <h2 className="text-xl font-semibold">Kod orqali</h2>
          <p className="mt-1 text-sm text-muted">Kod yarating va istalgan odamga yuboring, yoki olgan kodingizni kiriting.</p>
          <button type="button" className="btn mt-4 w-full" disabled={!!busy} onClick={() => go("code", { action: "create", mode: "code", subject })}>
            {busy === "code" && <Spinner />} Kod yaratish
          </button>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go("join", { action: "join", code: code.trim() });
            }}
          >
            <input className="field num uppercase" maxLength={6} placeholder="ABC123" aria-label="Battle kodi" value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ""))} />
            <button className="btn btn-primary" disabled={!!busy || code.length !== 6}>
              {busy === "join" && <Spinner />} Kirish
            </button>
          </form>
        </section>
      </div>
      <p className="mt-3 text-xs text-muted">
        XP: g‘alaba +{BATTLE_XP.win}, durang +{BATTLE_XP.draw}, ishtirok +{BATTLE_XP.play} (savollarning kamida yarmiga javob berilsa). Bitta battle uchun XP bir marta beriladi.
      </p>

      <h2 className="display mt-10 text-3xl">Battle tarixi</h2>
      {!mine && !err && <PageLoader />}
      {mine && mine.history.length === 0 && (
        <div className="mt-4">
          <EmptyState title="Hali battle o‘ynamadingiz">Birinchi raqibingizni toping!</EmptyState>
        </div>
      )}
      {mine && mine.history.length > 0 && (
        <ul className="mt-4 divide-y divide-hair border-y border-hair">
          {mine.history.map((h) => (
            <li key={h.id}>
              <Link href={`/battle/${h.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-paper-2">
                <span className={cx("chip", h.outcome ? OUTCOME[h.outcome].c : "chip-info")}>{h.outcome ? OUTCOME[h.outcome].t : STATUS[h.status]}</span>
                <span className="font-medium">{h.opponent ? `vs ${h.opponent}` : "raqib yo‘q"}</span>
                <span className="text-sm text-muted">{subjectName(h.subjectCode)}</span>
                {h.myCorrect != null && (
                  <span className="num ml-auto font-semibold">
                    {h.myCorrect} : {h.oppCorrect ?? 0} <span className="text-xs font-normal text-muted">/ {h.total}</span>
                  </span>
                )}
                <span className={cx("num text-xs text-muted", h.myCorrect == null && "ml-auto")}>{fmtDateTime(Date.parse(h.createdAt))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
