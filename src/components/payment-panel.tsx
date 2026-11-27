"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { Alert, Spinner } from "./ui";

export interface PaymentInfo {
  price: number;
  status: "pending" | "approved" | "rejected" | null;
  note: string;
  requestedAt: number | null;
  card: { number: string; holder: string; instructions: string } | null;
}

const som = (n: number) => `${n.toLocaleString("ru-RU")} so‘m`;

/** Shown on a paid test until the admin approves the candidate's transfer. */
export function PaymentPanel({ materialId, info, candidateId, onChange }: { materialId: string; info: PaymentInfo; candidateId: string; onChange: (p: PaymentInfo) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/materials/${encodeURIComponent(materialId)}/payment`, { method: "POST", body: { note } });
      onChange({ ...info, status: "pending", note, requestedAt: Date.now() });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!info.card) return;
    try {
      await navigator.clipboard.writeText(info.card.number.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <p className="eyebrow">Pullik test</p>
        <p className="num mt-1 text-3xl font-semibold">{som(info.price)}</p>
        {info.card ? (
          <div className="mt-3 overflow-hidden rounded-xl bg-ink p-5 text-paper shadow-lg">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] opacity-70">Shu kartaga o‘tkazing</span>
            <button type="button" onClick={copy} className="num mt-4 block text-left text-xl tracking-[0.12em] hover:opacity-80" title="Nusxalash">
              {info.card.number} <span className="ml-1 text-xs opacity-70">{copied ? "✓ nusxalandi" : "⧉"}</span>
            </button>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest opacity-80">{info.card.holder}</p>
          </div>
        ) : (
          <Alert tone="warn" className="mt-3">
            To‘lov rekvizitlari hali kiritilmagan. Iltimos, keyinroq qayta kiring.
          </Alert>
        )}
        {info.card?.instructions && <p className="mt-2 text-sm text-ink-2">{info.card.instructions}</p>}
      </div>

      <div>
        {info.status === "pending" ? (
          <Alert tone="info" title="To‘lovingiz tekshirilmoqda">
            So‘rov {info.requestedAt ? new Date(info.requestedAt).toLocaleString("uz-UZ") : ""} da yuborildi. Administrator tasdiqlashi bilan shu sahifada “Imtihonni boshlash” tugmasi
            paydo bo‘ladi. Izoh: “{info.note}”
          </Alert>
        ) : (
          <>
            {info.status === "rejected" && (
              <Alert tone="error" className="mb-3" title="To‘lov tasdiqlanmadi">
                Pul tushmagan yoki ma’lumot mos kelmadi. To‘lovni tekshirib, qayta so‘rov yuboring.
              </Alert>
            )}
            <ol className="space-y-1 text-sm text-ink-2">
              <li>1. {som(info.price)} ni yuqoridagi kartaga o‘tkazing.</li>
              <li>
                2. Izohga to‘lovchi ismini, karta oxirgi 4 raqamini va vaqtni yozing (Candidate ID: <b className="num">{candidateId}</b>).
              </li>
              <li>3. “To‘ladim” tugmasini bosing — tasdiqlangach test ochiladi.</li>
            </ol>
            <label className="label mt-3" htmlFor="paynote">
              Izoh
            </label>
            <textarea
              id="paynote"
              className="field min-h-20"
              maxLength={300}
              placeholder="Masalan: Ali Valiyev, karta …4521, 14:35 da o‘tkazdim"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {err && (
              <Alert tone="error" className="mt-2">
                {err}
              </Alert>
            )}
            <button type="button" className="btn btn-primary mt-3" disabled={busy || note.trim().length < 3 || !info.card} onClick={submit}>
              {busy && <Spinner />} To‘ladim — tekshirishga yuborish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
