"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { accessToken, api, errorText } from "@/lib/api";
import { cx, fmtDate } from "@/lib/format-utils";

interface Data {
  certificates: { id: string; serial: string; title: string; percent: number; level: string; issuedAt: number; status: string; revokedReason: string | null; verifyUrl: string }[];
  eligible: { attemptId: string; title: string; percent: number; publishedAt: number | null }[];
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Certificates />}</RequireCandidate>
    </Suspense>
  );
}

function Certificates() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<Data>("/api/certificates")
        .then(setD)
        .catch((e) => setErr(errorText(e))),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const issue = async (attemptId: string) => {
    setBusy(attemptId);
    setErr(null);
    try {
      await api("/api/certificates", { method: "POST", body: { attemptId } });
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  // The PDF route needs the auth header, so it is fetched and saved as a blob.
  const download = async (id: string, serial: string) => {
    setBusy(id);
    setErr(null);
    try {
      const token = await accessToken();
      const res = await fetch(`/api/certificates/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "PDF yuklab bo‘lmadi.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `milliy-mock-${serial}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">QR kod bilan tekshiriladi</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Sertifikatlar</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        E’lon qilingan to‘liq mock natijasi uchun sertifikat olishingiz mumkin. Bu <b>rasmiy davlat sertifikati emas</b> — Milliy Mock platformasining mock natija sertifikati. Har birida QR kod bor:
        uni skanerlagan odam haqiqiyligini tekshira oladi (ismingiz qisqartirib ko‘rsatiladi).
      </p>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {!d && !err && <PageLoader />}

      {d && d.eligible.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-2xl">Sertifikat olish mumkin</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {d.eligible.map((e) => (
              <li key={e.attemptId} className="sheet flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="num text-sm text-muted">
                    {e.percent}% · {fmtDate(e.publishedAt)}
                  </span>
                </span>
                <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={!!busy} onClick={() => issue(e.attemptId)}>
                  {busy === e.attemptId && <Spinner />} Sertifikat olish
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d && (
        <section className="mt-8">
          <h2 className="display text-2xl">Mening sertifikatlarim</h2>
          {d.certificates.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Hali sertifikat yo‘q"
                action={
                  <Link href="/imtihonlar" className="btn btn-primary">
                    Mock topshirish
                  </Link>
                }
              >
                To‘liq mock topshiring — natija e’lon qilingach shu yerda sertifikat olasiz.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-3 grid gap-4 md:grid-cols-2">
              {d.certificates.map((c) => (
                <li key={c.id} className={cx("sheet-hard p-5", c.status === "revoked" && "opacity-70")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num chip chip-ink">{c.serial}</span>
                    {c.status === "revoked" ? <span className="chip chip-accent">bekor qilingan</span> : <span className="chip chip-ok">haqiqiy</span>}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
                  <p className="num mt-1 text-3xl font-semibold">{c.percent}%</p>
                  <p className="text-sm text-muted">Berilgan: {fmtDate(c.issuedAt)}</p>
                  {c.revokedReason && <p className="mt-1 text-sm text-accent">Sabab: {c.revokedReason}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => download(c.id, c.serial)}>
                      {busy === c.id && <Spinner />} PDF yuklab olish
                    </button>
                    <a href={c.verifyUrl} target="_blank" rel="noopener" className="btn btn-sm">
                      Tekshirish sahifasi ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
