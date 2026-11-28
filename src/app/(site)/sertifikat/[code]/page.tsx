"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageLoader } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { fmtDate } from "@/lib/format-utils";

interface Result {
  serial: string;
  name: string;
  title: string;
  subjectCode: string;
  percent: number;
  score: number;
  maxScore: number;
  level: string;
  issuedAt: number;
  status: "valid" | "revoked";
  revokedReason: string | null;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Verify />
    </Suspense>
  );
}

/** Public page opened from the certificate's QR code — no login needed. */
function Verify() {
  const { code } = useParams<{ code: string }>();
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Result>(`/api/certificates/verify/${encodeURIComponent(code)}`, { auth: false })
      .then(setR)
      .catch((e) => setErr(errorText(e)));
  }, [code]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Sertifikatni tekshirish</p>
      {!r && !err && <PageLoader />}
      {err && (
        <div className="sheet-hard mt-4 p-8 text-center">
          <p className="text-5xl">✕</p>
          <h1 className="display mt-3 text-3xl">Sertifikat topilmadi</h1>
          <p className="mt-2 text-muted">{err} QR kod yoki havolani qayta tekshiring.</p>
        </div>
      )}
      {r && (
        <div className="sheet-hard crop mt-4 p-6 sm:p-8">
          <div className="text-center">
            <p className={r.status === "valid" ? "text-5xl text-ok" : "text-5xl text-accent"}>{r.status === "valid" ? "✓" : "!"}</p>
            <h1 className="display mt-2 text-3xl">{r.status === "valid" ? "Sertifikat haqiqiy" : "Sertifikat bekor qilingan"}</h1>
            {r.revokedReason && <p className="mt-1 text-sm text-accent">Sabab: {r.revokedReason}</p>}
          </div>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">Seriya</dt>
            <dd className="num font-semibold">{r.serial}</dd>
            <dt className="text-muted">Nomzod</dt>
            <dd className="font-semibold">{r.name}</dd>
            <dt className="text-muted">Test</dt>
            <dd>{r.title}</dd>
            <dt className="text-muted">Natija</dt>
            <dd className="num">
              <b>{r.percent}%</b> · xom ball {r.score}/{r.maxScore} · platforma bahosi: {r.level}
            </dd>
            <dt className="text-muted">Berilgan</dt>
            <dd className="num">{fmtDate(r.issuedAt)}</dd>
          </dl>
          <p className="mt-6 border-t border-hair pt-4 text-xs text-muted">
            Bu rasmiy davlat sertifikati emas. Milliy Mock platformasida topshirilgan mock imtihon natijasini tasdiqlaydi. Maxfiylik uchun nomzodning familiyasi qisqartirib ko‘rsatiladi.
          </p>
          <p className="mt-4 text-center">
            <Link href="/" className="btn btn-sm">
              Milliy Mock
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
