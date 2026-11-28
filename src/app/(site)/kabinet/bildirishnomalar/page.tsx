"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { fmtDateTime } from "@/lib/format-utils";

interface Prefs {
  results: boolean;
  daily_challenge: boolean;
  plan_reminders: boolean;
  battle_invites: boolean;
  mistakes_due: boolean;
  quiet_from: number | null;
  quiet_to: number | null;
}
interface Data {
  botReady: boolean;
  bot: string | null;
  linked: boolean;
  username: string | null;
  linkedAt: string | null;
  prefs: Prefs;
  recent: { kind: string; status: string; created_at: string }[];
}

const TOGGLES: { key: keyof Omit<Prefs, "quiet_from" | "quiet_to">; label: string; hint: string }[] = [
  { key: "results", label: "Natijalar va sertifikatlar", hint: "Mock natijasi e’lon qilinganda" },
  { key: "daily_challenge", label: "Kunlik challenge", hint: "Ertalab 08:00 da, agar hali topshirmagan bo‘lsangiz" },
  { key: "plan_reminders", label: "O‘quv reja", hint: "Bugungi vazifalar ro‘yxati" },
  { key: "battle_invites", label: "Battle takliflari", hint: "Do‘stingiz chaqirganda (jim soatlarda ham)" },
  { key: "mistakes_due", label: "Xatolarni takrorlash", hint: "Takrorlash vaqti kelgan xatolar soni" },
];
const KIND: Record<string, string> = { results: "Natija", system: "Tizim", battle_invites: "Battle", daily_challenge: "Challenge", plan_reminders: "Reja", mistakes_due: "Xatolar" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Notifications />}</RequireCandidate>
    </Suspense>
  );
}

function Notifications() {
  const [d, setD] = useState<Data | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<Data>("/api/me/telegram")
        .then((x) => {
          setD(x);
          setPrefs(x.prefs);
        })
        .catch((e) => setErr(errorText(e))),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  // While waiting for the student to press Start in Telegram, check every 4 s.
  useEffect(() => {
    if (!linkUrl || d?.linked) return;
    const t = window.setInterval(load, 4000);
    return () => window.clearInterval(t);
  }, [linkUrl, d?.linked, load]);

  const post = async (key: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(key);
    setErr(null);
    setNote(null);
    try {
      const r = await api<{ url?: string }>("/api/me/telegram", { method: "POST", body });
      if (r.url) {
        setLinkUrl(r.url);
        window.open(r.url, "_blank", "noopener");
      }
      if (ok) setNote(ok);
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!d || !prefs)
    return err ? (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">{err}</Alert>
      </div>
    ) : (
      <PageLoader />
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Telegram bot</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Bildirishnomalar</h1>
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

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="sheet-hard p-5">
          <h2 className="text-lg font-semibold">Telegram hisobi</h2>
          {!d.botReady ? (
            <p className="mt-2 text-sm text-muted">Bot hali sozlanmagan. Administrator ulagach bu yerda tugma paydo bo‘ladi.</p>
          ) : d.linked ? (
            <>
              <p className="mt-2">
                ✅ Ulangan{d.username ? ` (@${d.username})` : ""} · {fmtDateTime(d.linkedAt ? Date.parse(d.linkedAt) : null)}
              </p>
              <p className="mt-1 text-sm text-muted">Botda buyruqlar: /natija, /challenge, /reja, /xatolar, /xp, /sertifikat</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => post("test", { action: "test" }, "Sinov xabari yuborildi — Telegramni tekshiring.")}>
                  {busy === "test" && <Spinner />} Sinov xabari
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={!!busy}
                  onClick={() => window.confirm("Telegram hisobi uzilsinmi? Xabarlar kelmay qoladi.") && post("unlink", { action: "unlink" }, "Hisob uzildi.")}
                >
                  Uzish
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Tugmani bosing — Telegram ochiladi. U yerda “Start” (Boshlash) ni bosing, hisobingiz avtomatik ulanadi. Havola 15 daqiqa amal qiladi.</p>
              <button type="button" className="btn btn-primary mt-4" disabled={!!busy} onClick={() => post("link", { action: "link" })}>
                {busy === "link" && <Spinner />} Telegramni ulash
              </button>
              {linkUrl && (
                <p className="mt-3 text-sm">
                  Telegram ochilmadimi?{" "}
                  <a href={linkUrl} target="_blank" rel="noopener">
                    Havolani bosing
                  </a>{" "}
                  — ulangach bu sahifa o‘zi yangilanadi <Spinner className="ml-1 inline-block" />
                </p>
              )}
            </>
          )}
        </section>

        <form
          className="sheet-hard p-5"
          onSubmit={(e) => {
            e.preventDefault();
            post("prefs", { action: "prefs", ...prefs }, "Sozlamalar saqlandi.");
          }}
        >
          <h2 className="text-lg font-semibold">Qaysi xabarlar kelsin</h2>
          <ul className="mt-3 space-y-3">
            {TOGGLES.map((t) => (
              <li key={t.key}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={prefs[t.key]} onChange={(e) => setPrefs({ ...prefs, [t.key]: e.target.checked })} />
                  <span>
                    <span className="font-medium">{t.label}</span>
                    <span className="block text-xs text-muted">{t.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <fieldset className="mt-4">
            <legend className="label">Jim soatlar (Toshkent vaqti) — bu vaqtda xabar kelmaydi</legend>
            <div className="flex items-center gap-2">
              <select
                className="field w-28"
                aria-label="Boshlanishi"
                value={prefs.quiet_from ?? ""}
                onChange={(e) => setPrefs({ ...prefs, quiet_from: e.target.value === "" ? null : Number(e.target.value) })}
              >
                <option value="">—</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span>dan</span>
              <select
                className="field w-28"
                aria-label="Tugashi"
                value={prefs.quiet_to ?? ""}
                onChange={(e) => setPrefs({ ...prefs, quiet_to: e.target.value === "" ? null : Number(e.target.value) })}
              >
                <option value="">—</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span>gacha</span>
            </div>
          </fieldset>
          <button className="btn btn-primary mt-4" disabled={!!busy}>
            {busy === "prefs" && <Spinner />} Saqlash
          </button>
        </form>
      </div>

      {d.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-2xl">So‘nggi xabarlar</h2>
          <ul className="mt-3 divide-y divide-hair border-y border-hair text-sm">
            {d.recent.map((r, i) => (
              <li key={i} className="flex gap-3 py-2">
                <span className="chip">{KIND[r.kind] ?? r.kind}</span>
                <span className={r.status === "sent" ? "text-ok" : "text-accent"}>{r.status === "sent" ? "yuborildi" : r.status === "failed" ? "yuborilmadi" : "o‘tkazib yuborildi"}</span>
                <span className="num ml-auto text-muted">{fmtDateTime(Date.parse(r.created_at))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
