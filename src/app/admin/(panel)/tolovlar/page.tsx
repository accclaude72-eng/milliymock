"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";
import type { PaymentRecord, PaymentSettings } from "@/lib/types";

type Settings = PaymentSettings & { changedAt: string | null };
const STATUS = {
  pending: { label: "Kutilmoqda", chip: "chip-warn" },
  approved: { label: "Tasdiqlangan", chip: "chip-ok" },
  rejected: { label: "Rad etilgan", chip: "chip-accent" },
} as const;

const som = (n: number) => `${n.toLocaleString("ru-RU")} so‘m`;
const groupCard = (s: string) =>
  s
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

export default function PaymentsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<PaymentSettings>({ cardNumber: "", cardHolder: "", instructions: "" });
  const [list, setList] = useState<PaymentRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(() => {
    Promise.all([adminApi<Settings>("/api/admin/payment-settings"), adminApi<PaymentRecord[]>("/api/admin/payments")])
      .then(([s, l]) => {
        setSettings(s);
        setForm({ cardNumber: s.cardNumber, cardHolder: s.cardHolder, instructions: s.instructions });
        setList(l);
      })
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const saveCard = async () => {
    setBusy("card");
    setErr(null);
    setMsg(null);
    try {
      const s = await adminApi<Settings>("/api/admin/payment-settings", { method: "PUT", body: form });
      setSettings(s);
      setMsg("Karta rekvizitlari saqlandi. Pullik testlarda nomzodlar shu kartani ko‘radi.");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const decide = async (p: PaymentRecord, decision: "approved" | "rejected") => {
    const k = `${p.uid}:${p.materialId}`;
    setBusy(k);
    setErr(null);
    try {
      const r = await adminApi<PaymentRecord>("/api/admin/payments", { method: "POST", body: { uid: p.uid, materialId: p.materialId, decision } });
      setList((l) => l?.map((x) => (x.uid === p.uid && x.materialId === p.materialId ? r : x)) ?? null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!settings || !list) return err ? <Alert tone="error">{err}</Alert> : <PageLoader />;
  const shown = filter === "pending" ? list.filter((p) => p.status === "pending") : list;
  const pendingCount = list.filter((p) => p.status === "pending").length;
  const dirty = form.cardNumber !== settings.cardNumber || form.cardHolder !== settings.cardHolder || form.instructions !== settings.instructions;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Moliya</p>
      <h1 className="display mt-1 text-5xl">To‘lovlar</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Testga narxni material sahifasida qo‘yasiz. Nomzod shu kartaga pul o‘tkazadi va “To‘ladim” deb so‘rov yuboradi. Kartangizga pul tushganini tekshirib, so‘rovni tasdiqlang — test
        nomzodga ochiladi.
      </p>

      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {msg && (
        <Alert tone="ok" className="mt-4">
          {msg}
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="sheet h-fit p-5">
          <h2 className="display text-2xl">Karta rekvizitlari</h2>
          {/* live card preview */}
          <div className="mt-4 overflow-hidden rounded-xl bg-ink p-5 text-paper shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] opacity-70">Milliy Mock · to‘lov</span>
              <span className="h-7 w-10 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" aria-hidden />
            </div>
            <p className="num mt-6 text-xl tracking-[0.12em]">{form.cardNumber || "0000 0000 0000 0000"}</p>
            <p className="mt-3 font-mono text-xs uppercase tracking-widest opacity-80">{form.cardHolder || "ISM FAMILIYA"}</p>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="cn">
                Karta raqami
              </label>
              <input
                id="cn"
                inputMode="numeric"
                autoComplete="off"
                className="field num"
                placeholder="8600 1234 5678 9012"
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: groupCard(e.target.value) })}
              />
            </div>
            <div>
              <label className="label" htmlFor="ch">
                Karta egasi (ism familiya)
              </label>
              <input id="ch" autoComplete="off" className="field" maxLength={80} placeholder="Ism Familiya" value={form.cardHolder} onChange={(e) => setForm({ ...form, cardHolder: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ins">
                Qo‘shimcha ko‘rsatma (ixtiyoriy)
              </label>
              <textarea
                id="ins"
                className="field min-h-20"
                maxLength={500}
                placeholder="Masalan: izohga Candidate ID ni yozing. To‘lov 1–2 soat ichida tasdiqlanadi."
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <button type="button" className="btn btn-primary" disabled={!dirty || busy === "card"} onClick={saveCard}>
              {busy === "card" && <Spinner />} Saqlash
            </button>
            <p className="text-xs text-muted">{settings.changedAt ? `Oxirgi o‘zgarish: ${fmtDateTime(Date.parse(settings.changedAt))}` : "Hali kiritilmagan — pullik testlarda karta ko‘rinmaydi."}</p>
          </div>
        </section>

        <section className="sheet p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display text-2xl">
              So‘rovlar {pendingCount > 0 && <span className="chip chip-warn ml-2 align-middle">{pendingCount} kutilmoqda</span>}
            </h2>
            <div className="flex gap-1">
              {(["pending", "all"] as const).map((f) => (
                <button key={f} type="button" className={cx("btn btn-sm", filter === f && "btn-ink")} onClick={() => setFilter(f)}>
                  {f === "pending" ? "Kutilayotgan" : "Hammasi"}
                </button>
              ))}
              <button type="button" className="btn btn-sm btn-ghost" onClick={load} aria-label="Yangilash">
                ↻
              </button>
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={filter === "pending" ? "Kutilayotgan so‘rov yo‘q" : "Hali so‘rov yo‘q"}>Nomzod “To‘ladim” tugmasini bosganda so‘rov shu yerda paydo bo‘ladi.</EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {shown.map((p) => {
                const k = `${p.uid}:${p.materialId}`;
                const st = STATUS[p.status];
                return (
                  <li key={k} className="rounded-[3px] border border-hair p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {p.candidateName} <span className="num text-xs text-muted">{p.candidateId}</span>
                        </p>
                        <p className="text-sm text-ink-2">{p.materialTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-lg font-semibold">{som(p.amount)}</p>
                        <span className={cx("chip", st.chip)}>{st.label}</span>
                      </div>
                    </div>
                    <p className="mt-2 rounded-[2px] bg-paper-2 px-3 py-2 text-sm">
                      <span className="eyebrow mr-2">Izoh</span>
                      {p.note}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        So‘rov: {fmtDateTime(p.requestedAt)}
                        {p.decidedAt && ` · Qaror: ${fmtDateTime(p.decidedAt)}${p.decidedBy === "agent" ? " (agent)" : ""}`}
                      </span>
                      {p.status === "pending" && (
                        <span className="flex gap-2">
                          <button type="button" className="btn btn-sm btn-primary" disabled={busy === k} onClick={() => decide(p, "approved")}>
                            {busy === k && <Spinner />} ✓ Tasdiqlash
                          </button>
                          <button type="button" className="btn btn-sm btn-danger" disabled={busy === k} onClick={() => decide(p, "rejected")}>
                            ✕ Rad etish
                          </button>
                        </span>
                      )}
                      {p.status === "approved" && (
                        <button type="button" className="btn btn-sm btn-ghost text-accent-ink" disabled={busy === k} onClick={() => decide(p, "rejected")}>
                          Ruxsatni bekor qilish
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
