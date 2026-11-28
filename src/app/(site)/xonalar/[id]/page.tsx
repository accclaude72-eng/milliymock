"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { useLive } from "@/components/use-live";
import { api, errorText } from "@/lib/api";
import { ROOM_TIMER_MIN } from "@/lib/battle";
import { cx, fmtClock } from "@/lib/format-utils";

interface View {
  id: string;
  name: string;
  subjectCode: string | null;
  description: string | null;
  inviteCode: string;
  maxMembers: number;
  isOwner: boolean;
  muted: boolean;
  me: string;
  serverNow: number;
  timer: { mode: "focus" | "break"; endsAt: number } | null;
  members: {
    id: string;
    name: string;
    role: "owner" | "member";
    muted: boolean;
    online: boolean;
  }[];
  messages: {
    id: number;
    userId: string;
    name: string;
    body: string;
    at: number;
  }[];
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Room />}</RequireCandidate>
    </Suspense>
  );
}

function Room() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { subjects } = useSubjects();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(0);
  const skew = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const lastId = useRef(0);

  const load = useCallback(() => {
    api<View>(`/api/rooms/${id}`)
      .then((d) => {
        skew.current = d.serverNow - Date.now();
        setV(d);
      })
      .catch((e) => setErr(errorText(e)));
  }, [id]);
  useEffect(load, [load]);
  // New messages and timer changes arrive over Realtime; the 15 s poll is also the "online" heartbeat.
  useLive(
    v ? `room:${id}` : null,
    [
      { table: "study_room_messages", filter: `room_id=eq.${id}` },
      { table: "study_rooms", filter: `id=eq.${id}` },
    ],
    load,
    15_000,
  );

  // Keep the chat scrolled to the newest message.
  useEffect(() => {
    const newest = v?.messages.at(-1)?.id ?? 0;
    if (newest !== lastId.current && list.current) list.current.scrollTop = list.current.scrollHeight;
    lastId.current = newest;
  }, [v]);

  useEffect(() => {
    if (!v?.timer) return;
    const t = window.setInterval(() => setNow(Date.now() + skew.current), 500);
    return () => window.clearInterval(t);
  }, [v?.timer]);

  const post = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return false;
    setErr(null);
    try {
      await api(`/api/rooms/${id}`, { method: "POST", body });
      load();
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (await post({ action: "message", body })) setText("");
    setSending(false);
  };

  if (err && !v)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">
          {err} <Link href="/xonalar">Xonalarga qaytish</Link>
        </Alert>
      </div>
    );
  if (!v) return <PageLoader />;

  const online = v.members.filter((m) => m.online).length;
  const left = v.timer && now ? Math.max(0, v.timer.endsAt - now) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/xonalar" className="text-sm text-muted">
        ← Xonalar
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{v.subjectCode ? (subjects?.find((s) => s.code === v.subjectCode)?.name ?? v.subjectCode) : "Umumiy"}</p>
          <h1 className="display text-4xl">{v.name}</h1>
          {v.description && <p className="mt-1 max-w-2xl text-sm text-muted">{v.description}</p>}
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-muted">Taklif kodi</p>
          <p className="num select-all text-2xl font-semibold tracking-[0.15em]">{v.inviteCode}</p>
        </div>
      </div>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="sheet-hard flex h-[min(70vh,640px)] flex-col" aria-label="Chat">
          <ol ref={list} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {v.messages.length === 0 && <li className="py-10 text-center text-sm text-muted">Hali xabar yo‘q. Salom bering!</li>}
            {v.messages.map((m) => {
              const mine = m.userId === v.me;
              return (
                <li key={m.id} className={cx("group flex flex-col", mine ? "items-end" : "items-start")}>
                  <span className="text-xs text-muted">
                    {mine ? "Siz" : m.name} · {hhmm(m.at)}
                    {v.isOwner && !mine && (
                      <button
                        type="button"
                        className="ml-2 text-accent opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => post({ action: "delete_message", messageId: m.id }, "Xabar yashirilsinmi?")}
                      >
                        yashirish
                      </button>
                    )}
                  </span>
                  <p className={cx("mt-0.5 max-w-[85%] whitespace-pre-wrap break-words rounded-[3px] px-3 py-2 text-sm", mine ? "bg-ink text-paper" : "bg-paper-2")}>{m.body}</p>
                </li>
              );
            })}
          </ol>
          <form
            className="flex gap-2 border-t border-hair p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              className="field min-h-0 flex-1 resize-none"
              rows={1}
              maxLength={1000}
              placeholder={v.muted ? "Xona egasi yozishni cheklagan" : "Xabar yozing… (Enter — yuborish)"}
              aria-label="Xabar"
              disabled={v.muted}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="btn btn-primary" disabled={sending || v.muted || !text.trim()}>
              {sending && <Spinner />} Yuborish
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="sheet-hard p-4 text-center">
            <p className="eyebrow">Umumiy pomodoro</p>
            {v.timer ? (
              <>
                <p className={cx("num mt-2 text-5xl font-semibold", v.timer.mode === "focus" ? "text-accent" : "text-ok")}>{fmtClock(left)}</p>
                <p className="text-sm text-muted">{v.timer.mode === "focus" ? "Diqqat bilan o‘qish vaqti" : "Tanaffus"}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Taymer ishlamayapti</p>
            )}
            {v.isOwner && (
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => post({ action: "timer", mode: "focus" })}>
                  {ROOM_TIMER_MIN.focus} daq o‘qish
                </button>
                <button type="button" className="btn btn-sm" onClick={() => post({ action: "timer", mode: "break" })}>
                  {ROOM_TIMER_MIN.break} daq tanaffus
                </button>
                {v.timer && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => post({ action: "timer", mode: "stop" })}>
                    To‘xtatish
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="sheet-hard p-4">
            <p className="eyebrow">
              A’zolar · {online} onlayn / {v.members.length} (max {v.maxMembers})
            </p>
            <ul className="mt-3 space-y-2">
              {v.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className={m.online ? "text-ok" : "text-hair"} aria-label={m.online ? "onlayn" : "oflayn"}>
                    ●
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.id === v.me ? `${m.name} (siz)` : m.name}
                    {m.role === "owner" && <span className="ml-1 text-xs text-muted">· egasi</span>}
                    {m.muted && <span className="ml-1 text-xs text-accent">· cheklangan</span>}
                  </span>
                  {v.isOwner && m.id !== v.me && (
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-ink"
                        onClick={() =>
                          post({
                            action: m.muted ? "unmute" : "mute",
                            userId: m.id,
                          })
                        }
                      >
                        {m.muted ? "ruxsat" : "cheklash"}
                      </button>
                      <button type="button" className="text-xs text-accent" onClick={() => post({ action: "kick", userId: m.id }, `${m.name} xonadan chiqarilsinmi?`)}>
                        chiqarish
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={async () => {
              if (await post({ action: "leave" }, v.isOwner ? "Xonadan chiqasizmi? Egalik eng eski a’zoga o‘tadi (yolg‘iz bo‘lsangiz xona yopiladi)." : "Xonadan chiqasizmi?")) router.push("/xonalar");
            }}
          >
            Xonadan chiqish
          </button>
        </aside>
      </div>
    </div>
  );
}
