"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface ActionResult {
  method: string;
  path: string;
  body?: unknown;
  reason?: string;
  outcome: "done" | "failed" | "pending" | "rejected";
  status?: number;
  error?: string;
}
interface Run {
  id: string;
  task: string;
  report: string;
  rounds: number;
  actions: ActionResult[];
  startedAt: number;
  finishedAt: number;
  error?: string;
}
interface Pending {
  id: string;
  runId: string;
  task: string;
  method: string;
  path: string;
  body: unknown;
  reason: string;
  createdAt: number;
}
interface Data {
  config: { configured: boolean; telegram: boolean; agentId: string; conversationId: string };
  runs: Run[];
  pending: Pending[];
}

const QUICK = [
  ["📊 Kunlik hisobot", "Saytning bugungi holati bo‘yicha hisobot tayyorla: foydalanuvchilar, yangi ro‘yxatdan o‘tganlar, urinishlar, tekshiruv navbati, to‘lov so‘rovlari. Muammolar va tavsiyalarni yoz."],
  ["📝 Tekshiruv navbati", "Tekshiruvni kutayotgan (pending_review) urinishlarni ko‘rib chiq va qaysi biriga birinchi navbatda e’tibor berish kerakligini ayt."],
  ["💳 To‘lovlar", "Kutilayotgan to‘lov so‘rovlarini ko‘rib chiq va hisobot ber (tasdiqlashni men qilaman)."],
  ["📚 Materiallar", "Barcha test materiallarini tekshir: qoralamada qolganlar, kaliti to‘liq emaslar, narxi yo‘qlar. Ro‘yxat va tavsiya ber."],
] as const;

const OUTCOME = {
  done: ["Bajarildi", "chip-ok"],
  failed: ["Xato", "chip-accent"],
  pending: ["Tasdiq kutmoqda", "chip-warn"],
  rejected: ["Ruxsat etilmagan", "chip-accent"],
} as const;

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cx("h-2.5 w-2.5 rounded-full", on ? "bg-ok" : "bg-accent")} />
      {label}: <b>{on ? "ulangan" : "sozlanmagan"}</b>
    </span>
  );
}

export default function AgentPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<Data>("/api/admin/agent")
      .then((d) => {
        setData(d);
        setOpen((o) => o ?? d.runs[0]?.id ?? null);
      })
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const send = async (text: string) => {
    if (!text.trim() || running) return;
    setRunning(true);
    setElapsed(0);
    setErr(null);
    try {
      const run = await adminApi<Run>("/api/admin/agent", { method: "POST", body: { task: text } });
      setTask("");
      setOpen(run.id);
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setRunning(false);
    }
  };

  const resolve = async (p: Pending, decision: "confirm" | "decline") => {
    if (decision === "confirm" && !window.confirm(`${p.method} ${p.path}\n\nBu amalni bajarishni tasdiqlaysizmi?`)) return;
    setBusy(p.id);
    setErr(null);
    try {
      await adminApi("/api/admin/agent/pending", { method: "POST", body: { id: p.id, decision } });
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const runCheck = async (what: "agent" | "telegram" | "telegram_chats") => {
    setBusy(what);
    setCheck(null);
    setErr(null);
    try {
      const r = await adminApi<{ reply?: string; sent?: boolean; chats?: { id: number; name: string }[] }>("/api/admin/agent/check", { method: "POST", body: { what } });
      if (what === "agent") setCheck(`Agent javobi: “${r.reply}”`);
      else if (what === "telegram") setCheck("Telegramga test xabar yuborildi ✓");
      else
        setCheck(
          r.chats?.length
            ? `Botga yozgan chatlar: ${r.chats.map((c) => `${c.name || "—"} → ${c.id}`).join(" · ")}. Shu raqamni TELEGRAM_CHAT_ID ga yozing.`
            : "Hech kim botga yozmagan. Telegramda botingizni ochib /start yuboring va qayta bosing.",
        );
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return err ? <Alert tone="error">{err}</Alert> : <PageLoader />;
  const { config } = data;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Avtomatlashtirish</p>
      <h1 className="display mt-1 text-5xl">AI agent</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Base44 agentiga topshiriq bering. Agent saytning barcha admin bo‘limlarida ishlaydi (statistika, materiallar, narxlar, e’lon qilish, tekshiruv, dizayn…). O‘chirish, bloklash va pul
        bilan bog‘liq amallar esa siz shu yerda tasdiqlamaguncha bajarilmaydi. Har bir topshiriq hisoboti Telegramingizga yuboriladi.
      </p>

      <div className="sheet mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <Dot on={config.configured} label="Base44 agent" />
        <Dot on={config.telegram} label="Telegram" />
        <span className="num text-xs text-muted">
          agent {config.agentId} · suhbat {config.conversationId}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" disabled={!config.configured || !!busy} onClick={() => runCheck("agent")}>
            {busy === "agent" && <Spinner />} Agentni tekshirish
          </button>
          <button type="button" className="btn btn-sm" disabled={!config.telegram || !!busy} onClick={() => runCheck("telegram")}>
            {busy === "telegram" && <Spinner />} Telegram test
          </button>
          <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => runCheck("telegram_chats")}>
            {busy === "telegram_chats" && <Spinner />} Chat ID ni topish
          </button>
        </span>
      </div>
      {(!config.configured || !config.telegram) && (
        <Alert tone="warn" className="mt-4" title="Sozlash kerak (Vercel → Settings → Environment Variables)">
          {!config.configured && (
            <span className="block">
              <code>BASE44_API_TOKEN</code> — Base44 shaxsiy tokeni (full_access).
            </span>
          )}
          {!config.telegram && (
            <span className="block">
              <code>TELEGRAM_BOT_TOKEN</code> — @BotFather bergan token; <code>TELEGRAM_CHAT_ID</code> — botga /start yozib, “Chat ID ni topish” tugmasi bilan oling.
            </span>
          )}
          <span className="block">Qo‘shgandan so‘ng saytni qayta deploy qiling. Kalitlarni kod ichiga yozmang.</span>
        </Alert>
      )}
      {check && (
        <Alert tone="ok" className="mt-4">
          {check}
        </Alert>
      )}
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}

      {data.pending.length > 0 && (
        <section className="sheet mt-6 border-warn p-5">
          <h2 className="display text-2xl">Tasdiq kutayotgan amallar ({data.pending.length})</h2>
          <ul className="mt-3 space-y-3">
            {data.pending.map((p) => (
              <li key={p.id} className="rounded-[3px] border border-hair p-3">
                <p className="num text-sm font-semibold">
                  <span className={cx("chip mr-2", p.method === "DELETE" ? "chip-accent" : "chip-warn")}>{p.method}</span>
                  {p.path}
                </p>
                {p.reason && <p className="mt-1 text-sm text-ink-2">Sabab: {p.reason}</p>}
                {p.body != null && <pre className="mt-2 max-h-40 overflow-auto rounded-[2px] bg-paper-2 p-2 text-xs">{JSON.stringify(p.body, null, 2)}</pre>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {fmtDateTime(p.createdAt)} · topshiriq: “{p.task.slice(0, 80)}”
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => resolve(p, "confirm")}>
                      {busy === p.id && <Spinner />} Tasdiqlash va bajarish
                    </button>
                    <button type="button" className="btn btn-sm" disabled={busy === p.id} onClick={() => resolve(p, "decline")}>
                      Rad etish
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sheet-hard mt-6 p-5">
        <label className="label" htmlFor="task">
          Agentga topshiriq
        </label>
        <textarea
          id="task"
          className="field min-h-28"
          maxLength={4000}
          placeholder="Masalan: Multilevel Reading testiga 25 000 so‘m narx qo‘y va bugungi statistikani Telegramga yubor."
          value={task}
          disabled={running}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(task);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" disabled={running || !config.configured || task.trim().length < 3} onClick={() => send(task)}>
            {running && <Spinner />} {running ? `Agent ishlayapti… ${elapsed} s` : "Yuborish (Ctrl+Enter)"}
          </button>
          {QUICK.map(([label, text]) => (
            <button key={label} type="button" className="btn btn-sm" disabled={running || !config.configured} onClick={() => send(text)}>
              {label}
            </button>
          ))}
        </div>
        {running && <p className="mt-2 text-xs text-muted">Agent bir necha bosqichda ishlashi mumkin (5 daqiqagacha). Sahifani yopmang.</p>}
      </section>

      <h2 className="display mt-10 text-3xl">Topshiriqlar tarixi</h2>
      {data.runs.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Hali topshiriq berilmagan">Birinchi topshiriqni yuqoridan yuboring.</EmptyState>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.runs.map((r) => {
            const isOpen = open === r.id;
            const changed = r.actions.filter((a) => a.outcome === "done" && a.method !== "GET").length;
            return (
              <li key={r.id} className="sheet">
                <button type="button" className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                  <span className={cx("chip", r.error ? "chip-accent" : "chip-ok")}>{r.error ? "Xato" : "Tayyor"}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.task}</span>
                  <span className="num text-xs text-muted">
                    {fmtDateTime(r.startedAt)} · {Math.round((r.finishedAt - r.startedAt) / 1000)} s · {r.actions.length} amal{changed ? ` (${changed} o‘zgarish)` : ""}
                  </span>
                  <span aria-hidden>{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-hair p-4">
                    {r.error && (
                      <Alert tone="error" className="mb-3">
                        {r.error}
                      </Alert>
                    )}
                    <p className="eyebrow">Hisobot</p>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.report || "—"}</div>
                    {r.actions.length > 0 && (
                      <>
                        <p className="eyebrow mt-5">Amallar</p>
                        <ul className="mt-2 space-y-1">
                          {r.actions.map((a, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={cx("chip", OUTCOME[a.outcome][1])}>{OUTCOME[a.outcome][0]}</span>
                              <span className="num font-semibold">{a.method}</span>
                              <span className="num">{a.path}</span>
                              {a.status && <span className="text-muted">→ {a.status}</span>}
                              {a.reason && <span className="text-muted">· {a.reason}</span>}
                              {a.error && <span className="text-accent-ink">· {a.error}</span>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
