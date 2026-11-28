"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader, Spinner, Stat } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Cert {
  id: string;
  serial: string;
  candidate_name: string;
  candidate_id: string | null;
  material_title: string;
  percent: number;
  issued_at: string;
  status: "valid" | "revoked";
  revoked_reason: string | null;
}
interface Bot {
  tokenSet: boolean;
  secretSet: boolean;
  cronSet: boolean;
  bot: string | null;
  webhook: { url: string; pending: number; lastError: string | null; lastErrorAt: number | null } | null;
  linked: number;
  sent7d: number;
  failed7d: number;
}

export default function CertificatesAdmin() {
  const [certs, setCerts] = useState<{ certificates: Cert[]; checks30d: number; failedChecks30d: number } | null>(null);
  const [bot, setBot] = useState<Bot | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadCerts = useCallback(
    (search = "") =>
      adminApi<{ certificates: Cert[]; checks30d: number; failedChecks30d: number }>(`/api/admin/certificates${search ? `?q=${encodeURIComponent(search)}` : ""}`)
        .then(setCerts)
        .catch((e) => setErr(errorText(e))),
    [],
  );
  const loadBot = useCallback(
    () =>
      adminApi<Bot>("/api/admin/telegram")
        .then(setBot)
        .catch((e) => setErr(errorText(e))),
    [],
  );
  useEffect(() => {
    loadCerts();
    loadBot();
  }, [loadCerts, loadBot]);

  const certAct = async (c: Cert) => {
    const revoke = c.status === "valid";
    const reason = revoke ? window.prompt(`${c.serial} bekor qilinsin. Sababini yozing:`) : null;
    if (revoke && !reason?.trim()) return;
    setErr(null);
    try {
      await adminApi("/api/admin/certificates", { method: "POST", body: { action: revoke ? "revoke" : "restore", id: c.id, reason: reason?.trim() } });
      loadCerts(q);
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const botAct = async (action: "set_webhook" | "delete_webhook") => {
    setBusy(action);
    setErr(null);
    setNote(null);
    try {
      const r = await adminApi<{ url?: string }>("/api/admin/telegram", { method: "POST", body: { action } });
      setNote(r.url ? `Webhook o‘rnatildi: ${r.url}` : "Webhook o‘chirildi.");
      loadBot();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!certs && !bot && !err) return <PageLoader />;
  const step = (okv: boolean, text: React.ReactNode) => (
    <li className="flex gap-2">
      <span className={okv ? "text-ok" : "text-accent"}>{okv ? "✓" : "○"}</span>
      <span>{text}</span>
    </li>
  );
  return (
    <div>
      <p className="eyebrow">15 · Sertifikat va bot</p>
      <h1 className="display mt-1 text-4xl">Sertifikatlar va Telegram bot</h1>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {note && (
        <Alert tone="ok" className="mt-4">
          {note}
        </Alert>
      )}

      {bot && (
        <section className="sheet-hard mt-6 p-5">
          <h2 className="text-xl font-semibold">Nomzodlar uchun Telegram bot {bot.bot && <span className="text-muted">@{bot.bot}</span>}</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 md:max-w-xl">
            <Stat label="Ulangan nomzodlar" value={bot.linked} tone="accent" />
            <Stat label="Yuborildi (7 kun)" value={bot.sent7d} tone="ok" />
            <Stat label="Xato (7 kun)" value={bot.failed7d} />
          </div>
          <ol className="mt-5 space-y-2 text-sm">
            {step(
              bot.tokenSet,
              <>
                Vercel → Settings → Environment Variables: <code>TELEGRAM_BOT_TOKEN</code> (hisobotlar uchun allaqachon kiritilgan bot)
              </>,
            )}
            {step(
              bot.secretSet,
              <>
                <code>TELEGRAM_WEBHOOK_SECRET</code> — o‘zingiz o‘ylab topgan 32+ belgili tasodifiy harf/raqam (faqat A–Z, a–z, 0–9, _ , -)
              </>,
            )}
            {step(
              bot.cronSet,
              <>
                <code>CRON_SECRET</code> — ertalabki eslatmalar uchun (yana bir tasodifiy satr). Kiritgach Redeploy qiling.
              </>,
            )}
            {step(
              !!bot.webhook?.url,
              <>
                Pastdagi “Webhookni o‘rnatish” tugmasini <b>joylangan saytda</b> (milliymock.vercel.app/admin) bosing.
              </>,
            )}
          </ol>
          {bot.webhook && (
            <p className="mt-4 text-xs text-muted">
              Webhook: {bot.webhook.url || "o‘rnatilmagan"} · navbatda: {bot.webhook.pending}
              {bot.webhook.lastError && (
                <span className="text-accent">
                  {" "}
                  · oxirgi xato: {bot.webhook.lastError} ({fmtDateTime(bot.webhook.lastErrorAt)})
                </span>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !bot.tokenSet} onClick={() => botAct("set_webhook")}>
              {busy === "set_webhook" && <Spinner />} Webhookni o‘rnatish
            </button>
            {bot.webhook?.url && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!!busy}
                onClick={() => window.confirm("Webhook o‘chirilsinmi? Bot buyruqlarga javob bermay qoladi.") && botAct("delete_webhook")}
              >
                O‘chirish
              </button>
            )}
          </div>
        </section>
      )}

      {certs && (
        <section className="mt-8">
          <div className="grid grid-cols-3 gap-3 md:max-w-xl">
            <Stat label="Sertifikatlar" value={certs.certificates.length} />
            <Stat label="Tekshiruvlar (30 kun)" value={certs.checks30d} tone="ok" />
            <Stat label="Topilmagan kodlar" value={certs.failedChecks30d} />
          </div>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadCerts(q.trim());
            }}
          >
            <input className="field max-w-sm" placeholder="Seriya, ism yoki Candidate ID" aria-label="Qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn">Qidirish</button>
          </form>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2">Seriya</th>
                  <th>Nomzod</th>
                  <th>Test</th>
                  <th>Natija</th>
                  <th>Berilgan</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-hair border-y border-hair">
                {certs.certificates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted">
                      Sertifikat yo‘q.
                    </td>
                  </tr>
                )}
                {certs.certificates.map((c) => (
                  <tr key={c.id} className={cx(c.status === "revoked" && "opacity-60")}>
                    <td className="num py-2">{c.serial}</td>
                    <td>
                      {c.candidate_name} <span className="num text-xs text-muted">{c.candidate_id}</span>
                    </td>
                    <td className="max-w-[16rem] truncate">{c.material_title}</td>
                    <td className="num">{Number(c.percent)}%</td>
                    <td className="num text-muted">{fmtDateTime(Date.parse(c.issued_at))}</td>
                    <td className="text-right">
                      <button type="button" className="btn btn-sm" onClick={() => certAct(c)} title={c.revoked_reason ?? undefined}>
                        {c.status === "valid" ? "Bekor qilish" : "Tiklash"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
