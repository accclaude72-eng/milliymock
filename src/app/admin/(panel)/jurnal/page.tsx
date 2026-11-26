"use client";

import { useEffect, useState } from "react";
import { Alert, PageLoader } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { ACTION_LABEL } from "@/lib/audit-labels";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Entry {
  id: string;
  at: number;
  actor: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
}

export default function AuditPage() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    adminApi<Entry[]>("/api/admin/audit")
      .then(setRows)
      .catch((e) => setErr(errorText(e)));
  }, []);
  if (err) return <Alert tone="error">{err}</Alert>;
  if (!rows) return <PageLoader />;
  const shown = rows.filter((r) => !q || `${r.action} ${ACTION_LABEL[r.action] ?? ""} ${r.target}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Audit</p>
      <h1 className="display mt-1 text-5xl">Audit jurnali</h1>
      <p className="mt-2 text-sm text-muted">Oxirgi 300 ta yozuv. Jurnal faqat server tomonidan yoziladi va tahrirlab bo‘lmaydi.</p>
      <input type="search" aria-label="Filtr" className="field mt-6 max-w-md" placeholder="Harakat yoki obyekt bo‘yicha filtr…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="sheet mt-4 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Harakat</th>
              <th>Obyekt</th>
              <th>Tafsilotlar</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="num whitespace-nowrap text-xs">{fmtDateTime(r.at)}</td>
                <td className={cx("whitespace-nowrap", r.action === "admin.login_failed" && "text-accent-ink")}>
                  {ACTION_LABEL[r.action] ?? r.action}
                  <p className="font-mono text-[0.65rem] text-muted">{r.actor}</p>
                </td>
                <td className="num text-xs">{r.target}</td>
                <td>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">ko‘rish</summary>
                    <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap font-mono text-[0.68rem]">{JSON.stringify(r.details, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
