"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, PageLoader, Stat } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { ACTION_LABEL } from "@/lib/audit-labels";
import { fmtDateTime } from "@/lib/format-utils";

interface Stats {
  users: number;
  newUsers7d: number;
  activeUsers24h: number;
  attempts: number;
  pendingReview: number;
  publishedMaterials: number;
  draftMaterials: number;
  bySubject: { code: string; name: string; total: number; finished: number }[];
  recentUsers: { uid: string; name: string; email: string; candidateId: string; createdAt: number; region: string }[];
  recentAudit: { id: string; at: number; actor: string; action: string; target: string }[];
}

export default function AdminHome() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    adminApi<Stats>("/api/admin/stats")
      .then(setS)
      .catch((e) => setErr(errorText(e)));
  }, []);
  if (err) return <Alert tone="error" title="Statistikani yuklab bo‘lmadi">{err}</Alert>;
  if (!s) return <PageLoader />;
  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Boshqaruv paneli</p>
      <h1 className="display mt-1 text-5xl">Umumiy holat</h1>
      <p className="mt-2 text-sm text-muted">Barcha raqamlar ma’lumotlar bazasidan jonli hisoblanadi.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ro‘yxatdan o‘tganlar" value={s.users} hint={`+${s.newUsers7d} so‘nggi 7 kunda`} />
        <Stat label="Faol (24 soat)" value={s.activeUsers24h} />
        <Stat label="Urinishlar" value={s.attempts} />
        <Stat label="Tekshiruv kutmoqda" value={s.pendingReview} tone={s.pendingReview ? "accent" : undefined} hint={<Link href="/admin/natijalar" className="link">Navbatni ochish</Link>} />
        <Stat label="E’lon qilingan testlar" value={s.publishedMaterials} />
        <Stat label="Qoralamalar" value={s.draftMaterials} hint={<Link href="/admin/materiallar" className="link">Materiallar</Link>} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="sheet p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-2xl">Yangi foydalanuvchilar</h2>
            <Link href="/admin/foydalanuvchilar" className="link text-sm">
              Hammasi →
            </Link>
          </div>
          {s.recentUsers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Hali ro‘yxatdan o‘tganlar yo‘q.</p>
          ) : (
            <ul className="mt-3 divide-y divide-hair">
              {s.recentUsers.map((u) => (
                <li key={u.uid} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{u.name}</span> <span className="text-muted">· {u.email}</span>
                    {u.region && <span className="block text-xs text-muted">{u.region}</span>}
                  </span>
                  <span className="num text-xs">
                    {u.candidateId} · {fmtDateTime(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="sheet p-5">
          <h2 className="display text-2xl">Fanlar bo‘yicha urinishlar</h2>
          <table className="table mt-3">
            <thead>
              <tr>
                <th>Fan</th>
                <th className="text-right">Jami</th>
                <th className="text-right">Yakunlangan</th>
              </tr>
            </thead>
            <tbody>
              {s.bySubject.map((b) => (
                <tr key={b.code}>
                  <td>{b.name}</td>
                  <td className="num text-right">{b.total}</td>
                  <td className="num text-right">{b.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="sheet mt-6 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-2xl">So‘nggi harakatlar</h2>
          <Link href="/admin/jurnal" className="link text-sm">
            Jurnal →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-hair text-sm">
          {s.recentAudit.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className={a.action === "admin.login_failed" ? "text-accent-ink" : ""}>{ACTION_LABEL[a.action] ?? a.action}</span>
              <span className="num text-xs text-muted">
                {a.target} · {fmtDateTime(a.at)}
              </span>
            </li>
          ))}
          {s.recentAudit.length === 0 && <li className="py-2 text-muted">Hali yozuv yo‘q.</li>}
        </ul>
      </section>
    </div>
  );
}
