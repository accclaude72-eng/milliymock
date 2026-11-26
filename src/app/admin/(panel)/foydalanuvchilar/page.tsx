"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Modal, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { candidateAuth, clientConfigured } from "@/lib/firebase/client";
import { cx, fmtDateTime, fmtNum } from "@/lib/format-utils";
import { ATTEMPT_STATUS_LABEL, type AttemptStatus, type Profile } from "@/lib/types";

type Row = Profile & { attempts: number };

export default function UsersAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [data, setData] = useState<{ users: Row[]; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ profile: Profile; attempts: { id: string; materialTitle: string; subjectName: string; status: AttemptStatus; createdAt: number; percent: number | null }[] } | null>(null);
  const [confirm, setConfirm] = useState<{ u: Row; action: "suspend" | "activate" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (query: string, st: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (query) p.set("q", query);
      if (st) p.set("status", st);
      setData(await adminApi<{ users: Row[]; total: number }>(`/api/admin/users?${p}`));
      setErr(null);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q.trim(), status), 300);
    return () => clearTimeout(t);
  }, [q, status, load]);

  const csvHref = `/api/admin/users?format=csv${q ? `&q=${encodeURIComponent(q.trim())}` : ""}${status ? `&status=${status}` : ""}`;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Foydalanuvchilar</p>
          <h1 className="display mt-1 text-5xl">Nomzodlar</h1>
          <p className="mt-2 text-sm text-muted">Eng yangi ro‘yxatdan o‘tganlar yuqorida.</p>
        </div>
        <a href={csvHref} className="btn" download>
          CSV eksport
        </a>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <input type="search" aria-label="Qidirish" className="field max-w-md" placeholder="Ism, email, Candidate ID, telefon, hudud…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Holat" className="field w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Barcha holatlar</option>
          <option value="active">Faol</option>
          <option value="suspended">Bloklangan</option>
        </select>
        {loading && <Spinner className="self-center" />}
      </div>
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
      {!data ? (
        !err && <PageLoader />
      ) : data.users.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={q || status ? "Hech kim topilmadi" : "Hali ro‘yxatdan o‘tganlar yo‘q"} />
        </div>
      ) : (
        <>
          <p className="mt-4 font-mono text-xs text-muted">{data.total} ta foydalanuvchi</p>
          <div className="sheet mt-2 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate ID</th>
                  <th>Ism</th>
                  <th>Aloqa</th>
                  <th>Hudud / muassasa</th>
                  <th>Ro‘yxatdan o‘tgan</th>
                  <th className="text-right">Urinish</th>
                  <th>Holat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.uid}>
                    <td className="num whitespace-nowrap font-semibold">{u.candidateId}</td>
                    <td className="whitespace-nowrap">
                      {u.firstName} {u.lastName}
                      {u.grade && <p className="text-xs text-muted">{u.grade}</p>}
                    </td>
                    <td className="text-sm">
                      {u.email}
                      <span className={cx("ml-1 text-xs", u.emailVerified ? "text-ok" : "text-warn")} title={u.emailVerified ? "Email tasdiqlangan" : "Email tasdiqlanmagan"}>
                        {u.emailVerified ? "✓" : "!"}
                      </span>
                      {u.phone && <p className="num text-xs text-muted">{u.phone}</p>}
                    </td>
                    <td className="text-xs text-ink-2">
                      {u.region || "—"}
                      {u.institution && <p>{u.institution}</p>}
                    </td>
                    <td className="num whitespace-nowrap text-xs">{fmtDateTime(u.createdAt)}</td>
                    <td className="num text-right">{u.attempts}</td>
                    <td>{u.status === "active" ? <span className="chip chip-ok">Faol</span> : <span className="chip chip-accent">Bloklangan</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={async () => {
                            try {
                              setDetail(await adminApi(`/api/admin/users/${u.uid}`));
                            } catch (e) {
                              setErr(errorText(e));
                            }
                          }}
                        >
                          Batafsil
                        </button>
                        <button type="button" className={cx("btn btn-sm", u.status === "active" ? "btn-ghost btn-danger" : "btn-ink")} onClick={() => setConfirm({ u, action: u.status === "active" ? "suspend" : "activate" })}>
                          {u.status === "active" ? "Bloklash" : "Faollashtirish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.profile.firstName} ${detail.profile.lastName}` : ""} wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Candidate ID", detail.profile.candidateId],
                ["Email", detail.profile.email],
                ["Telefon", detail.profile.phone || "—"],
                ["Hudud", detail.profile.region || "—"],
                ["Muassasa", detail.profile.institution || "—"],
                ["Sinf/kurs", detail.profile.grade || "—"],
                ["Ro‘yxatdan o‘tgan", fmtDateTime(detail.profile.createdAt)],
                ["Oxirgi faollik", fmtDateTime(detail.profile.lastSeenAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-0.5 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {clientConfigured && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await sendPasswordResetEmail(candidateAuth(), detail.profile.email);
                    setNote(`Parolni tiklash havolasi ${detail.profile.email} manziliga yuborildi.`);
                    setDetail(null);
                  } catch (e) {
                    setErr(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Parolni tiklash xatini yuborish
              </button>
            )}
            <div>
              <p className="eyebrow">Urinishlar ({detail.attempts.length})</p>
              {detail.attempts.length === 0 ? (
                <p className="mt-1 text-muted">Hali urinish yo‘q.</p>
              ) : (
                <table className="table mt-1">
                  <tbody>
                    {detail.attempts.map((a) => (
                      <tr key={a.id}>
                        <td className="num whitespace-nowrap text-xs">{fmtDateTime(a.createdAt)}</td>
                        <td>
                          {a.materialTitle}
                          <p className="text-xs text-muted">{a.subjectName}</p>
                        </td>
                        <td className="text-xs">{ATTEMPT_STATUS_LABEL[a.status]}</td>
                        <td className="num text-right">{a.percent !== null ? `${fmtNum(a.percent)}%` : "—"}</td>
                        <td>
                          <Link className="link text-xs" href={`/admin/natijalar/${a.id}`}>
                            Ochish
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.action === "suspend" ? "Foydalanuvchini bloklash" : "Foydalanuvchini faollashtirish"}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                setBusy(true);
                try {
                  await adminApi(`/api/admin/users/${confirm.u.uid}`, { method: "PATCH", body: { action: confirm.action } });
                  setConfirm(null);
                  await load(q.trim(), status);
                } catch (e) {
                  setErr(errorText(e));
                  setConfirm(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Spinner />} Tasdiqlash
            </button>
          </>
        }
      >
        <p className="text-sm">
          {confirm?.action === "suspend"
            ? `${confirm?.u.firstName} ${confirm?.u.lastName} (${confirm?.u.candidateId}) tizimga kira olmaydi va faol sessiyalari bekor qilinadi. Natijalari saqlanib qoladi.`
            : `${confirm?.u.firstName} ${confirm?.u.lastName} yana tizimga kira oladi.`}
        </p>
      </Modal>
    </div>
  );
}
