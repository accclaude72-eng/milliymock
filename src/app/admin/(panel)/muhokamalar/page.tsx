"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Report {
  id: string;
  targetType: "thread" | "reply";
  targetId: string;
  reason: string;
  note: string | null;
  status: string;
  at: string;
  post: { name: string; body: string; status: string; questionId: string } | null;
}
interface Recent {
  type: "thread" | "reply";
  id: string;
  name: string;
  body: string;
  status: string;
  questionId: string;
  at: string;
}
const REASON: Record<string, string> = { spam: "Spam", abuse: "Haqorat", wrong: "Noto‘g‘ri ma’lumot", spoiler: "Javob oshkor qilingan", other: "Boshqa" };

export default function DiscussionsAdmin() {
  const [d, setD] = useState<{ reports: Report[]; recent: Recent[] } | null>(null);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<{ reports: Report[]; recent: Recent[] }>(`/api/admin/discussions${all ? "?reports=all" : ""}`)
      .then(setD)
      .catch((e) => setErr(errorText(e)));
  }, [all]);
  useEffect(load, [load]);

  const act = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      await adminApi("/api/admin/discussions", { method: "POST", body });
      load();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  if (!d && !err) return <PageLoader />;
  const open = d?.reports.filter((r) => r.status === "open").length ?? 0;
  return (
    <div>
      <p className="eyebrow">14 · Moderatsiya</p>
      <h1 className="display mt-1 text-4xl">Savol muhokamalari</h1>
      <p className="mt-1 text-sm text-muted">
        Xabarlar o‘chirilmaydi — yashiriladi va kerak bo‘lsa qaytariladi. Yashirish shu xabar bo‘yicha ochiq shikoyatlarni yopadi. Har bir amal audit jurnaliga yoziladi.
      </p>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="display text-2xl">Shikoyatlar {open > 0 && <span className="chip chip-accent align-middle">{open} ochiq</span>}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Yopilganlarni ham ko‘rsatish
        </label>
      </div>
      <ul className="mt-3 divide-y divide-hair border-y border-hair">
        {d?.reports.length === 0 && <li className="py-4 text-sm text-muted">Ochiq shikoyat yo‘q.</li>}
        {d?.reports.map((r) => (
          <li key={r.id} className={cx("flex flex-wrap items-start gap-3 py-3", r.status !== "open" && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                <span className="chip chip-warn mr-1">{REASON[r.reason] ?? r.reason}</span>
                {r.targetType === "thread" ? "Mavzu" : "Javob"} · <b className="text-ink">{r.post?.name ?? "—"}</b> · {fmtDateTime(Date.parse(r.at))} · {r.status}
                {r.post?.status === "hidden" && " · yashirilgan"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.post?.body ?? "(xabar topilmadi)"}</p>
              {r.note && <p className="mt-1 text-xs text-muted">Izoh: {r.note}</p>}
            </div>
            {r.status === "open" && r.post && (
              <span className="flex gap-1">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => act({ action: "hide", type: r.targetType, id: r.targetId })}>
                  Yashirish
                </button>
                <button type="button" className="btn btn-sm" onClick={() => act({ action: "dismiss", reportId: r.id })}>
                  Rad etish
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <h2 className="display mt-10 text-2xl">So‘nggi xabarlar</h2>
      <ul className="mt-3 divide-y divide-hair border-y border-hair">
        {d?.recent.length === 0 && <li className="py-4 text-sm text-muted">Hali xabar yo‘q.</li>}
        {d?.recent.map((p) => (
          <li key={p.id} className={cx("flex flex-wrap items-start gap-3 py-3", p.status === "hidden" && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                {p.type === "thread" ? "Mavzu" : "Javob"} · <b className="text-ink">{p.name}</b> · {fmtDateTime(Date.parse(p.at))} · savol {p.questionId}
                {p.status === "hidden" && " · yashirilgan"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.body}</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => act({ action: p.status === "hidden" ? "restore" : "hide", type: p.type, id: p.id })}>
              {p.status === "hidden" ? "Qaytarish" : "Yashirish"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
