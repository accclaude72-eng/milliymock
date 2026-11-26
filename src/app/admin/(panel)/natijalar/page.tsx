"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, EmptyState, PageLoader } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime, fmtNum } from "@/lib/format-utils";
import { ATTEMPT_STATUS_LABEL, type AttemptStatus } from "@/lib/types";

interface Row {
  id: string;
  candidateId: string;
  candidateName: string;
  materialTitle: string;
  subjectName: string;
  status: AttemptStatus;
  createdAt: number;
  submittedAt: number | null;
  percent: number | null;
  score: number | null;
  max: number | null;
  needsReview: number;
  hasO2: boolean;
  o2Reviewed: number;
  o2Count: number;
}

const FILTERS: { k: string; l: string }[] = [
  { k: "pending_review", l: "Tekshiruv kutmoqda" },
  { k: "graded", l: "Baholangan (e’lon kutmoqda)" },
  { k: "published", l: "E’lon qilingan" },
  { k: "in_progress", l: "Jarayonda" },
  { k: "", l: "Barchasi" },
];

export default function ResultsAdmin() {
  const [status, setStatus] = useState("pending_review");
  const [loaded, setLoaded] = useState<{ status: string; rows: Row[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Rows belonging to another filter are treated as "still loading".
  const rows = loaded && loaded.status === status ? loaded.rows : null;

  useEffect(() => {
    let alive = true;
    adminApi<Row[]>(`/api/admin/attempts${status ? `?status=${status}` : ""}`)
      .then((r) => alive && setLoaded({ status, rows: r }))
      .catch((e) => alive && setErr(errorText(e)));
    return () => {
      alive = false;
    };
  }, [status]);

  return (
    <div className="mx-auto max-w-7xl">
      <p className="eyebrow">Natijalar</p>
      <h1 className="display mt-1 text-5xl">Urinishlar va tekshiruv</h1>
      <p className="mt-2 text-sm text-muted">Yozma ishlar (O2) va shubhali qisqa javoblar ekspert tomonidan tekshirilgach, natijani e’lon qiling.</p>
      <div className="mt-6 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button key={f.k} type="button" aria-pressed={status === f.k} className={cx("btn btn-sm", status === f.k ? "btn-ink" : "btn-ghost")} onClick={() => setStatus(f.k)}>
            {f.l}
          </button>
        ))}
      </div>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {!rows ? (
        !err && <PageLoader />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Bu holatda urinish yo‘q" />
        </div>
      ) : (
        <div className="sheet mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nomzod</th>
                <th>Material</th>
                <th>Holat</th>
                <th className="text-right">Xom natija</th>
                <th>Tekshiruv</th>
                <th>Topshirilgan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {r.candidateName}
                    <p className="num text-xs text-muted">{r.candidateId}</p>
                  </td>
                  <td className="min-w-56">
                    {r.materialTitle}
                    <p className="text-xs text-muted">{r.subjectName}</p>
                  </td>
                  <td className="text-xs">{ATTEMPT_STATUS_LABEL[r.status]}</td>
                  <td className="num text-right">{r.percent !== null ? `${fmtNum(r.score ?? 0, 2)}/${r.max} · ${fmtNum(r.percent)}%` : "—"}</td>
                  <td className="text-xs">
                    {r.hasO2 && (
                      <span className={cx("chip mr-1", r.o2Reviewed === r.o2Count ? "chip-ok" : "chip-info")}>
                        O2 {r.o2Reviewed}/{r.o2Count}
                      </span>
                    )}
                    {r.needsReview > 0 && <span className="chip chip-warn">O1 ? {r.needsReview}</span>}
                  </td>
                  <td className="num whitespace-nowrap text-xs">{fmtDateTime(r.submittedAt ?? r.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/natijalar/${r.id}`} className={cx("btn btn-sm", r.status === "pending_review" ? "btn-primary" : "")}>
                      {r.status === "pending_review" ? "Tekshirish" : "Ochish"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
