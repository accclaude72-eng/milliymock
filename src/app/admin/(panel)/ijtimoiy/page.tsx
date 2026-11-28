"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader, Stat } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Data {
  battles: {
    week: number;
    finished: number;
    byMode: { random: number; friend: number; code: number };
  };
  friendships: number;
  rooms: {
    id: string;
    name: string;
    subjectCode: string | null;
    status: "active" | "hidden_by_admin";
    createdAt: string;
    members: number;
    maxMembers: number;
    owner: string;
  }[];
  messages: {
    id: number;
    room: string;
    name: string;
    body: string;
    at: string;
    deleted: boolean;
  }[];
}

export default function SocialAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    adminApi<Data>("/api/admin/social")
      .then(setD)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setErr(null);
    try {
      await adminApi("/api/admin/social", { method: "POST", body });
      load();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  if (!d && !err) return <PageLoader />;
  const msgs = (d?.messages ?? []).filter((m) => !q || (m.body + m.name + m.room).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <p className="eyebrow">11 · Moderatsiya</p>
      <h1 className="display mt-1 text-4xl">Battle va o‘quv xonalari</h1>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {d && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Battle (7 kun)" value={d.battles.week} tone="accent" hint={`${d.battles.finished} tasi yakunlangan`} />
            <Stat label="Tasodifiy / do‘st / kod" value={`${d.battles.byMode.random} / ${d.battles.byMode.friend} / ${d.battles.byMode.code}`} />
            <Stat label="Do‘stliklar" value={d.friendships} />
            <Stat label="Faol xonalar" value={d.rooms.filter((r) => r.status === "active").length} tone="ok" />
          </div>

          <h2 className="display mt-10 text-2xl">O‘quv xonalari</h2>
          {d.rooms.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Hali xona yo‘q.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-2">Nomi</th>
                    <th>Egasi</th>
                    <th>A’zolar</th>
                    <th>Ochilgan</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair border-y border-hair">
                  {d.rooms.map((r) => (
                    <tr key={r.id} className={cx(r.status === "hidden_by_admin" && "opacity-60")}>
                      <td className="py-2 font-medium">
                        {r.name}
                        {r.status === "hidden_by_admin" && <span className="chip chip-accent ml-2">yashirilgan</span>}
                      </td>
                      <td>{r.owner}</td>
                      <td className="num">
                        {r.members}/{r.maxMembers}
                      </td>
                      <td className="num text-muted">{fmtDateTime(Date.parse(r.createdAt))}</td>
                      <td className="text-right">
                        {r.status === "active" ? (
                          <button type="button" className="btn btn-sm" onClick={() => act({ action: "hide_room", roomId: r.id }, `“${r.name}” xonasi yashirilsinmi? A’zolar unga kira olmaydi.`)}>
                            Yashirish
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm" onClick={() => act({ action: "restore_room", roomId: r.id })}>
                            Qaytarish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <h2 className="display text-2xl">So‘nggi xabarlar</h2>
            <input className="field max-w-xs" placeholder="Qidirish…" aria-label="Xabarlarni qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="mt-1 text-xs text-muted">Xabarlar o‘chirilmaydi — yashiriladi va kerak bo‘lsa qaytariladi. Har bir amal audit jurnaliga yoziladi.</p>
          <ul className="mt-3 divide-y divide-hair border-y border-hair">
            {msgs.length === 0 && <li className="py-4 text-sm text-muted">Xabar yo‘q.</li>}
            {msgs.map((m) => (
              <li key={m.id} className={cx("flex flex-wrap items-start gap-3 py-3", m.deleted && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {m.room} · <b className="text-ink">{m.name}</b> · {fmtDateTime(Date.parse(m.at))}
                    {m.deleted && " · yashirilgan"}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    act({
                      action: m.deleted ? "restore_message" : "hide_message",
                      messageId: m.id,
                    })
                  }
                >
                  {m.deleted ? "Qaytarish" : "Yashirish"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
