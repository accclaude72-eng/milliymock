"use client";

import { ref as storageRef, uploadBytesResumable } from "firebase/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError, api, errorText } from "@/lib/api";
import { candidateAuth, candidateStorage } from "@/lib/firebase/client";
import { cx, fmtClock, fmtDateTime } from "@/lib/format-utils";
import type { AnswerValue, Answers } from "@/lib/grading";
import type { PlayerViewT, QuestionSheetItem } from "@/lib/types";
import { BookletFrame } from "../booklet-frame";
import { Alert, Logo, Modal, PageLoader, Spinner } from "../ui";
import { O1Row, O2Block, Y1Row, Y2Block } from "./inputs";

type SaveState = "saved" | "pending" | "saving" | "offline" | "error";

const HEARTBEAT_MS = 15_000;
const DEBOUNCE_MS = 700;

function isAnswered(v: AnswerValue | undefined, filesCount = 0): boolean {
  if (filesCount > 0) return true;
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some((x) => x !== "");
  return v.text.trim() !== "";
}

function storageKey(kind: "pending" | "flags" | "cid", id: string) {
  return `mm:${kind}:${id}`;
}
function readLS<T>(k: string, fallback: T, session = false): T {
  try {
    const raw = (session ? sessionStorage : localStorage).getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(k: string, v: unknown, session = false) {
  try {
    (session ? sessionStorage : localStorage).setItem(k, JSON.stringify(v));
  } catch {
    /* storage full / blocked — autosave to server still works */
  }
}
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ExamPlayer({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [view, setView] = useState<PlayerViewT | null>(null);
  const [bookletUrl, setBookletUrl] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [current, setCurrent] = useState<number | null>(null);
  // The player only ever renders in the browser (behind the auth guard), so storage is available.
  const [flags, setFlags] = useState<number[]>(() => (typeof window === "undefined" ? [] : readLS<number[]>(storageKey("flags", attemptId), [])));
  /** server clock − client clock (ms), refreshed on every server response */
  const [offset, setOffset] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [confirm, setConfirm] = useState<"advance" | "submit" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"booklet" | "sheet">("sheet");
  const [navOpen, setNavOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [bookletNonce, setBookletNonce] = useState(0);
  const [expiring, setExpiring] = useState(false);

  const pending = useRef(new Map<string, AnswerValue | null>());
  const inflight = useRef(false);
  const clientId = useRef<string>("");
  const takeover = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<{ timer: ReturnType<typeof setTimeout> | null; delay: number }>({ timer: null, delay: 2000 });
  const viewRef = useRef<PlayerViewT | null>(null);
  const finishedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const expiredFor = useRef<number | null>(null);
  const sheetScroll = useRef<HTMLDivElement>(null);
  const announce = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------- helpers */

  const persistPending = useCallback(() => {
    writeLS(storageKey("pending", attemptId), Object.fromEntries(pending.current));
  }, [attemptId]);

  const goToResults = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    pending.current.clear();
    try {
      localStorage.removeItem(storageKey("pending", attemptId));
    } catch {}
    router.replace(`/natija/${attemptId}`);
  }, [attemptId, router]);

  const applyView = useCallback(
    (v: PlayerViewT, sentAt: number) => {
      const receivedAt = Date.now();
      setOffset(v.serverNow - (sentAt + receivedAt) / 2);
      const prev = viewRef.current;
      viewRef.current = v;
      if (v.status !== "in_progress") {
        setView(v);
        goToResults();
        return;
      }
      // Drop queued edits for questions that are no longer editable (section closed).
      const editable = new Set(v.sheet.filter((s) => s.section === v.timing.index).map((s) => String(s.n)));
      let dropped = 0;
      for (const k of Array.from(pending.current.keys()))
        if (!editable.has(k)) {
          pending.current.delete(k);
          dropped++;
        }
      if (dropped) persistPending();
      const merged: Answers = { ...v.answers };
      for (const [k, val] of pending.current) {
        if (val === null) delete merged[k];
        else merged[k] = val;
      }
      setAnswers(merged);
      setView(v);
      if (prev && prev.timing.index !== v.timing.index) {
        const sec = v.format.sections[v.timing.index];
        setNotice({
          title: `${v.timing.index + 1}-bosqich boshlandi`,
          body: `${prev.format.sections[prev.timing.index]?.title ?? "Oldingi bosqich"} yopildi. Endi: ${sec?.title ?? ""}${sec ? ` (${sec.from}–${sec.to}-topshiriqlar)` : ""}.`,
        });
        const first = v.sheet.find((s) => s.section === v.timing.index);
        if (first) setCurrent(first.n);
      }
    },
    [goToResults, persistPending],
  );

  const refreshToken = useCallback(async () => {
    try {
      tokenRef.current = (await candidateAuth().currentUser?.getIdToken()) ?? null;
    } catch {
      /* ignore */
    }
  }, []);

  /* ----------------------------------------------------------- autosave */

  const flush = useCallback(async (): Promise<boolean> => {
    if (inflight.current || finishedRef.current) return false;
    if (pending.current.size === 0) return true;
    const snapshot = Object.fromEntries(pending.current);
    const snapJson = new Map(Object.entries(snapshot).map(([k, v]) => [k, JSON.stringify(v)]));
    inflight.current = true;
    setSaveState("saving");
    const sentAt = Date.now();
    try {
      const res = await api<{ view: PlayerViewT; result: { accepted: string[]; rejected: { n: string; reason: string }[] } }>(`/api/attempts/${attemptId}/save`, {
        method: "POST",
        body: { clientId: clientId.current, changes: snapshot, takeover: takeover.current },
      });
      takeover.current = false;
      for (const k of [...res.result.accepted, ...res.result.rejected.map((r) => r.n)]) {
        if (JSON.stringify(pending.current.get(k)) === snapJson.get(k)) pending.current.delete(k);
      }
      persistPending();
      retry.current.delay = 2000;
      if (res.result.rejected.length && res.view.status === "in_progress") {
        setActionErr(`${res.result.rejected.map((r) => r.n).join(", ")}-topshiriq javobi saqlanmadi: ${res.result.rejected[0].reason}.`);
      }
      setLastSavedAt(Date.now());
      applyView(res.view, sentAt);
      setSaveState(pending.current.size ? "pending" : "saved");
      return pending.current.size === 0;
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "conflict") {
        setConflict(true);
        setSaveState("error");
      } else if (e instanceof ApiClientError && (e.status === 0 || e.status >= 500 || e.status === 429)) {
        setSaveState("offline");
        const d = retry.current.delay;
        retry.current.delay = Math.min(d * 2, 30_000);
        if (retry.current.timer) clearTimeout(retry.current.timer);
        retry.current.timer = setTimeout(() => void flushRef.current(), d);
      } else {
        setSaveState("error");
        setActionErr(errorText(e));
      }
      return false;
    } finally {
      inflight.current = false;
    }
  }, [attemptId, applyView, persistPending]);

  // "Latest callback" ref: timers and listeners always call the newest flush without re-subscribing.
  const flushRef = useRef(flush);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- intentional latest-ref pattern; only written inside an effect
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback(
    (n: number, v: AnswerValue | null) => {
      const vw = viewRef.current;
      if (!vw || finishedRef.current) return;
      pending.current.set(String(n), v);
      persistPending();
      setAnswers((a) => {
        const next = { ...a };
        if (v === null) delete next[String(n)];
        else next[String(n)] = v;
        return next;
      });
      setSaveState("pending");
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void flushRef.current(), DEBOUNCE_MS);
    },
    [persistPending],
  );

  const heartbeat = useCallback(async () => {
    if (finishedRef.current) return;
    if (pending.current.size) {
      await flushRef.current();
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    const sentAt = Date.now();
    try {
      const res = await api<{ view: PlayerViewT }>(`/api/attempts/${attemptId}/heartbeat`, {
        method: "POST",
        body: { clientId: clientId.current, takeover: takeover.current },
      });
      takeover.current = false;
      applyView(res.view, sentAt);
      setSaveState((s) => (s === "offline" || s === "error" ? "saved" : s));
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "conflict") setConflict(true);
      else if (e instanceof ApiClientError && e.status === 0) setSaveState("offline");
    } finally {
      inflight.current = false;
    }
    void refreshToken();
  }, [attemptId, applyView, refreshToken]);

  /* ---------------------------------------------------------------- load */

  useEffect(() => {
    let cid = readLS<string>(storageKey("cid", attemptId), "", true);
    if (!cid) {
      cid = newId();
      writeLS(storageKey("cid", attemptId), cid, true);
    }
    clientId.current = cid;
    const stored = readLS<Record<string, AnswerValue | null>>(storageKey("pending", attemptId), {});
    pending.current = new Map(Object.entries(stored));

    const sentAt = Date.now();
    api<{ view: PlayerViewT; bookletUrl: string | null }>(`/api/attempts/${attemptId}`)
      .then((r) => {
        setBookletUrl(r.bookletUrl);
        applyView(r.view, sentAt);
        const first = r.view.sheet.find((s) => s.section === r.view.timing.index);
        setCurrent((c) => c ?? first?.n ?? null);
        if (pending.current.size) void flushRef.current();
      })
      .catch((e) => setLoadErr(errorText(e)));
    void refreshToken();
  }, [attemptId, applyView, refreshToken]);

  // Clock tick + heartbeat + reconnect handling.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    const hb = setInterval(() => void heartbeat(), HEARTBEAT_MS);
    const online = () => {
      retry.current.delay = 2000;
      void flushRef.current();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(tick);
      clearInterval(hb);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [heartbeat]);

  // Last-chance save when the tab is closed / hidden.
  useEffect(() => {
    const onHide = () => {
      if (!pending.current.size || !tokenRef.current || finishedRef.current) return;
      try {
        void fetch(`/api/attempts/${attemptId}/save`, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
          body: JSON.stringify({ clientId: clientId.current, changes: Object.fromEntries(pending.current), takeover: false }),
        });
      } catch {}
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size && !finishedRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [attemptId]);

  /* --------------------------------------------------------------- timer */

  const deadline = view?.timing.deadline ?? null;
  const remaining = deadline !== null ? Math.max(0, deadline - (now + offset)) : null;
  const timeUp = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (!timeUp || deadline === null || expiredFor.current === deadline) return;
    expiredFor.current = deadline;
    setExpiring(true);
    (async () => {
      await flushRef.current();
      // Let the server reconcile: it closes the section at the deadline (or finalizes).
      for (let i = 0; i < 5 && !finishedRef.current; i++) {
        await heartbeat();
        if (viewRef.current?.timing.deadline !== deadline) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      setExpiring(false);
    })();
  }, [timeUp, deadline, heartbeat]);

  // Screen-reader announcements at 10 / 5 / 1 minutes.
  const lastAnnounced = useRef<number | null>(null);
  useEffect(() => {
    if (remaining === null || !announce.current) return;
    const mins = Math.ceil(remaining / 60000);
    if ([10, 5, 1].includes(mins) && lastAnnounced.current !== mins && remaining > 0) {
      lastAnnounced.current = mins;
      announce.current.textContent = `Bosqich tugashiga ${mins} daqiqa qoldi.`;
    }
  }, [remaining]);

  /* ------------------------------------------------------------ derived */

  const sectionIdx = view?.timing.index ?? 0;
  const items = useMemo(() => (view ? view.sheet.filter((s) => s.section === sectionIdx) : []), [view, sectionIdx]);
  const locked = !view || view.status !== "in_progress" || timeUp || expiring || conflict || submitting;
  const files = view?.o2Files ?? {};
  const answeredCount = items.filter((s) => isAnswered(answers[String(s.n)], files[String(s.n)]?.length ?? 0)).length;
  const isLastSection = view ? sectionIdx >= view.format.sections.length - 1 : true;
  const o2Missing = items.filter((s) => s.type === "O2" && !isAnswered(answers[String(s.n)], files[String(s.n)]?.length ?? 0));

  const toggleFlag = (n: number) => {
    setFlags((f) => {
      const next = f.includes(n) ? f.filter((x) => x !== n) : [...f, n];
      writeLS(storageKey("flags", attemptId), next);
      return next;
    });
  };

  const goTo = (n: number) => {
    setCurrent(n);
    setMobileTab("sheet");
    setNavOpen(false);
    requestAnimationFrame(() => document.getElementById(`q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const step = (d: number) => {
    if (!items.length) return;
    const i = Math.max(0, items.findIndex((s) => s.n === current));
    const next = items[Math.min(items.length - 1, Math.max(0, i + d))];
    if (next) goTo(next.n);
  };

  /* ------------------------------------------------------------ actions */

  const doAdvance = async () => {
    if (!view) return;
    setSubmitting(true);
    setActionErr(null);
    try {
      await flushRef.current();
      const sentAt = Date.now();
      const res = await api<{ view: PlayerViewT }>(`/api/attempts/${attemptId}/advance`, { method: "POST", body: { clientId: clientId.current, fromIndex: view.timing.index } });
      setConfirm(null);
      applyView(res.view, sentAt);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "conflict") setConflict(true);
      else setActionErr(errorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setActionErr(null);
    try {
      await flushRef.current();
      if (pending.current.size) {
        setActionErr("Ba’zi javoblar hali serverga yuborilmagan. Internet aloqasini tekshirib, qayta urinib ko‘ring.");
        setSubmitting(false);
        return;
      }
      const sentAt = Date.now();
      const res = await api<{ view: PlayerViewT }>(`/api/attempts/${attemptId}/submit`, { method: "POST", body: { clientId: clientId.current } });
      applyView(res.view, sentAt);
    } catch (e) {
      setActionErr(errorText(e));
      setSubmitting(false);
    }
  };

  const uploadFile = useCallback(async (n: number, f: File) => {
    const user = candidateAuth().currentUser;
    if (!user) throw new Error("Sessiya tugagan. Qayta kiring.");
    const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "fayl";
    const path = `submissions/${user.uid}/${attemptId}/${n}/${newId()}-${safe}`;
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef(candidateStorage(), path), f, { contentType: f.type });
      task.on("state_changed", undefined, (err) => reject(new Error(err.code === "storage/unauthorized" ? "Faylni yuklashga ruxsat berilmadi (turi yoki hajmi noto‘g‘ri)." : "Faylni yuklab bo‘lmadi. Internet aloqasini tekshiring.")), () => resolve());
    });
    const sentAt = Date.now();
    const res = await api<{ view: PlayerViewT }>(`/api/attempts/${attemptId}/files`, { method: "POST", body: { n: String(n), path, name: f.name } });
    applyView(res.view, sentAt);
  }, [attemptId, applyView]);
  const removeFile = useCallback(async (n: number, fileId: string) => {
    try {
      const sentAt = Date.now();
      const res = await api<{ view: PlayerViewT }>(`/api/attempts/${attemptId}/files`, { method: "DELETE", body: { n: String(n), fileId } });
      applyView(res.view, sentAt);
    } catch (e) {
      setActionErr(errorText(e));
    }
  }, [attemptId, applyView]);
  const openFile = useCallback(async (fileId: string) => {
    const w = window.open("about:blank", "_blank");
    try {
      const r = await api<{ url: string }>(`/api/attempts/${attemptId}/files/${fileId}`);
      if (w) {
        w.opener = null;
        w.location.href = r.url;
      }
    } catch (e) {
      w?.close();
      setActionErr(errorText(e));
    }
  }, [attemptId]);

  const reloadBooklet = async () => {
    try {
      const sentAt = Date.now();
      const r = await api<{ view: PlayerViewT; bookletUrl: string | null }>(`/api/attempts/${attemptId}`);
      // Never modify the URL itself (it may be a signed URL); remount the frame instead.
      setBookletUrl(r.bookletUrl);
      setBookletNonce((x) => x + 1);
      applyView(r.view, sentAt);
    } catch (e) {
      setActionErr(errorText(e));
    }
  };

  /* --------------------------------------------------------------- render */

  if (loadErr)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="Imtihonni ochib bo‘lmadi">
          {loadErr} <Link href="/kabinet">Kabinetga qaytish</Link>
        </Alert>
      </div>
    );
  if (!view) return <PageLoader label="Imtihon yuklanmoqda…" />;
  if (view.status !== "in_progress") return <PageLoader label="Natijalarga yo‘naltirilmoqda…" />;

  const section = view.format.sections[sectionIdx];
  const lowTime = remaining !== null && remaining < 5 * 60_000;

  const renderItem = (it: QuestionSheetItem) => {
    const common = {
      item: it,
      value: answers[String(it.n)],
      onChange: (v: AnswerValue | null) => onChange(it.n, v),
      disabled: locked,
      current: current === it.n,
      flagged: flags.includes(it.n),
      onFocusRow: () => setCurrent(it.n),
    };
    if (it.type === "Y1") return <Y1Row key={it.n} {...common} />;
    if (it.type === "Y2") return <Y2Block key={it.n} {...common} />;
    if (it.type === "O1" || it.type === "O") return <O1Row key={it.n} {...common} />;
    return (
      <O2Block
        key={it.n}
        {...common}
        files={files[String(it.n)] ?? []}
        onUpload={(f) => uploadFile(it.n, f)}
        onRemove={(fid) => removeFile(it.n, fid)}
        onOpen={(fid) => openFile(fid)}
      />
    );
  };

  const navigator = (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Savollar navigatori</p>
        <p className="num text-xs">
          {answeredCount}/{items.length}
        </p>
      </div>
      <ol className="mt-2 grid grid-cols-8 gap-1 sm:grid-cols-10" aria-label="Savollar holati">
        {items.map((it) => {
          const a = isAnswered(answers[String(it.n)], files[String(it.n)]?.length ?? 0);
          const fl = flags.includes(it.n);
          const cur = current === it.n;
          return (
            <li key={it.n}>
              <button
                type="button"
                onClick={() => goTo(it.n)}
                aria-current={cur ? "true" : undefined}
                aria-label={`${it.n}-savol: ${a ? "javob berilgan" : "javob berilmagan"}${fl ? ", belgilangan" : ""}${cur ? ", hozirgi" : ""}`}
                className={cx(
                  "num relative grid h-8 w-full place-items-center rounded-[2px] border text-[0.72rem] font-semibold transition-colors",
                  a ? "border-ink bg-ink text-paper" : "border-ink/50 bg-card text-ink hover:border-ink",
                  cur && "outline-2 outline-offset-1 outline-accent",
                )}
              >
                {it.n}
                {fl && <span className="absolute -right-1 -top-1.5 text-[0.7rem] text-accent" aria-hidden>⚑</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-muted">
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 border border-ink bg-ink" /> javob berilgan
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 border border-ink/50 bg-card" /> javobsiz
        </li>
        <li>⚑ belgilangan ({flags.filter((f) => items.some((i) => i.n === f)).length})</li>
      </ul>
    </div>
  );

  const saveBadge = {
    saved: { t: lastSavedAt ? `Saqlandi · ${fmtDateTime(lastSavedAt).slice(-5)}` : "Saqlangan", c: "bg-ok" },
    pending: { t: "Saqlanmoqda…", c: "bg-warn" },
    saving: { t: "Saqlanmoqda…", c: "bg-warn" },
    offline: { t: "Aloqa yo‘q · navbatda", c: "bg-accent" },
    error: { t: "Saqlanmadi", c: "bg-accent" },
  }[saveState];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <div ref={announce} aria-live="polite" className="sr-only" />
      {/* ---------------------------------------------------------- top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b-[1.5px] border-ink bg-ink px-3 text-paper sm:px-4">
        <span className="hidden text-sm sm:block [&_*]:!text-paper [&_.ring-ink]:ring-paper">
          <Logo compact />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{view.materialTitle}</p>
          <p className="truncate font-mono text-[0.65rem] uppercase tracking-[0.1em] text-paper/60">
            {view.subjectName} · {view.format.sections.length > 1 ? `${sectionIdx + 1}/${view.format.sections.length}-bosqich · ` : ""}
            <span className="hidden sm:inline">ID </span>
            {view.candidateId}
          </p>
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-[0.68rem] text-paper/80 md:flex" role="status">
          <span className={cx("h-2 w-2 rounded-full", saveBadge.c)} aria-hidden /> {saveBadge.t}
        </span>
        <div
          className={cx("num rounded-[2px] border px-2.5 py-1 text-lg font-semibold tabular-nums sm:text-xl", lowTime ? "border-accent bg-accent text-white" : "border-paper/30")}
          aria-label={remaining !== null ? `Bosqich tugashiga ${fmtClock(remaining)} qoldi` : "Vaqt cheklanmagan"}
          role="timer"
        >
          {remaining !== null ? fmtClock(remaining) : "∞"}
        </div>
        <button
          type="button"
          className="btn btn-sm !border-paper !bg-paper !text-ink"
          disabled={locked}
          onClick={() => {
            setActionErr(null);
            setConfirm(isLastSection ? "submit" : "advance");
          }}
        >
          {isLastSection ? "Yakunlash" : "Bosqichni yakunlash"}
        </button>
      </header>

      {/* section strip */}
      <div className="flex shrink-0 items-center gap-3 border-b border-hair bg-card px-3 py-1.5 text-xs sm:px-4">
        <span className="font-semibold">{section?.title}</span>
        <span className="num text-muted">
          {section?.from}–{section?.to}-topshiriqlar
        </span>
        <span className="ml-auto flex items-center gap-1.5 md:hidden" role="status">
          <span className={cx("h-2 w-2 rounded-full", saveBadge.c)} aria-hidden /> <span className="font-mono">{saveBadge.t}</span>
        </span>
      </div>

      {(timeUp || expiring) && (
        <div role="alert" className="flex shrink-0 items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-white">
          <Spinner /> Bosqich vaqti tugadi. Javoblar qulflandi, server natijani qayd etmoqda…
        </div>
      )}
      {actionErr && !confirm && (
        <div className="shrink-0 px-3 pt-2 sm:px-4">
          <Alert tone="error">
            {actionErr}{" "}
            <button type="button" className="link" onClick={() => setActionErr(null)}>
              Yopish
            </button>
          </Alert>
        </div>
      )}

      {/* mobile tabs */}
      <div className="flex shrink-0 border-b-[1.5px] border-ink lg:hidden" role="tablist">
        {(
          [
            ["booklet", "Test kitobchasi"],
            ["sheet", "Javoblar varaqasi"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mobileTab === k} type="button" onClick={() => setMobileTab(k)} className={cx("flex-1 py-2.5 text-sm font-semibold", mobileTab === k ? "bg-ink text-paper" : "bg-paper")}>
            {l}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- body */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,36%)]">
        {/* booklet */}
        <section aria-label="Test kitobchasi" className={cx("relative min-h-0 flex-col border-ink lg:flex lg:border-r-[1.5px]", mobileTab === "booklet" ? "flex" : "hidden")}>
          <div className="flex shrink-0 items-center gap-1.5 border-b border-hair bg-paper-2/70 px-3 py-1.5">
            <span className="eyebrow mr-auto">Test kitobchasi</span>
            <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2" aria-label="Kichraytirish" onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))}>
              A−
            </button>
            <span className="num w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2" aria-label="Kattalashtirish" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}>
              A+
            </button>
            <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2" onClick={reloadBooklet} title="Kitobchani qayta yuklash">
              ↻
            </button>
            {bookletUrl && (
              <a href={bookletUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm !min-h-0 !px-2" title="Yangi oynada ochish">
                ↗
              </a>
            )}
          </div>
          <div className="relative min-h-0 flex-1 bg-white">
            {bookletUrl ? (
              <BookletFrame key={bookletNonce} url={bookletUrl} title="Test kitobchasi" zoom={zoom} />
            ) : (
              <div className="p-6">
                <Alert tone="warn">Kitobcha manzili olinmadi. ↻ tugmasi bilan qayta urinib ko‘ring.</Alert>
              </div>
            )}
          </div>
        </section>

        {/* answer sheet */}
        <section aria-label="Javoblar varaqasi" className={cx("min-h-0 flex-col bg-card lg:flex", mobileTab === "sheet" ? "flex" : "hidden")}>
          <div className="hidden shrink-0 border-b border-hair p-3 lg:block">{navigator}</div>
          <div ref={sheetScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3">
            {sectionIdx > 0 && (
              <p className="mb-3 border border-dashed border-ink/40 bg-paper px-3 py-2 text-xs text-muted">
                🔒 Oldingi bosqich(lar) yopilgan — u yerdagi javoblar o‘zgartirilmaydi.
              </p>
            )}
            <div className="space-y-1">
              {items.map((it, i) => {
                const prev = items[i - 1];
                const header = !prev || prev.type !== it.type;
                return (
                  <div key={it.n}>
                    {header && (
                      <p className="eyebrow mb-1 mt-3 border-b border-hair pb-1 first:mt-0">
                        {it.type} · {it.type === "Y1" ? "bitta to‘g‘ri javobni belgilang" : it.type === "Y2" ? "har bir element uchun mos javob" : it.type === "O2" ? "yozma ish" : "qisqa javob yozing"}
                      </p>
                    )}
                    {renderItem(it)}
                  </div>
                );
              })}
            </div>
            {!view.timed && (
              <p className="mt-4 text-center font-mono text-xs text-muted">Bu mashq vaqt bilan cheklanmagan.</p>
            )}
          </div>
          {/* controls */}
          <div className="flex shrink-0 items-center gap-1.5 border-t-[1.5px] border-ink bg-paper px-2 py-2 sm:px-3">
            <button type="button" className="btn btn-sm" onClick={() => step(-1)} aria-label="Oldingi savol">
              ←<span className="hidden sm:inline"> Oldingi</span>
            </button>
            <button type="button" className="btn btn-sm" onClick={() => step(1)} aria-label="Keyingi savol">
              <span className="hidden sm:inline">Keyingi </span>→
            </button>
            <button
              type="button"
              className={cx("btn btn-sm", current !== null && flags.includes(current) && "!bg-accent-soft")}
              disabled={current === null}
              aria-pressed={current !== null && flags.includes(current)}
              onClick={() => current !== null && toggleFlag(current)}
            >
              ⚑<span className="hidden sm:inline"> Belgilash</span>
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={current === null || locked || !answers[String(current)]} onClick={() => current !== null && onChange(current, null)}>
              Tozalash
            </button>
            <button type="button" className="btn btn-sm ml-auto lg:hidden" onClick={() => setNavOpen(true)}>
              ☰ <span className="num">{answeredCount}/{items.length}</span>
            </button>
          </div>
        </section>
      </div>

      {/* mobile navigator bottom sheet */}
      <Modal open={navOpen} onClose={() => setNavOpen(false)} title="Savollar">
        {navigator}
      </Modal>

      {/* confirm advance / submit */}
      <Modal
        open={confirm !== null}
        onClose={() => !submitting && setConfirm(null)}
        dismissable={!submitting}
        title={confirm === "submit" ? "Imtihonni yakunlaysizmi?" : `${sectionIdx + 1}-bosqichni yakunlaysizmi?`}
        footer={
          <>
            <button type="button" className="btn" disabled={submitting} onClick={() => setConfirm(null)}>
              Qaytish
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={confirm === "submit" ? doSubmit : doAdvance}>
              {submitting && <Spinner />} {confirm === "submit" ? "Ha, yakunlash" : "Ha, keyingi bosqichga"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-hair p-2">
              <p className="num text-2xl font-semibold">{answeredCount}</p>
              <p className="eyebrow !text-[0.6rem]">javob berilgan</p>
            </div>
            <div className="border border-hair p-2">
              <p className={cx("num text-2xl font-semibold", items.length - answeredCount > 0 && "text-accent")}>{items.length - answeredCount}</p>
              <p className="eyebrow !text-[0.6rem]">javobsiz</p>
            </div>
            <div className="border border-hair p-2">
              <p className="num text-2xl font-semibold">{flags.filter((f) => items.some((i) => i.n === f)).length}</p>
              <p className="eyebrow !text-[0.6rem]">belgilangan</p>
            </div>
          </div>
          {items.length - answeredCount > 0 && (
            <p>
              Javobsiz topshiriqlar:{" "}
              <span className="num font-semibold">
                {items
                  .filter((s) => !isAnswered(answers[String(s.n)], files[String(s.n)]?.length ?? 0))
                  .map((s) => s.n)
                  .join(", ")}
              </span>
            </p>
          )}
          {o2Missing.length > 0 && <Alert tone="warn">Yozma ish topshiriqlari ({o2Missing.map((s) => s.n).join(", ")}) uchun matn ham, fayl ham yo‘q.</Alert>}
          <p className="text-ink-2">
            {confirm === "submit"
              ? "Yakunlangandan so‘ng javoblarni o‘zgartirib bo‘lmaydi. Test qismi darhol avtomatik tekshiriladi."
              : "Bu bosqich yopiladi va undagi javoblarni qayta o‘zgartirib bo‘lmaydi. Keyingi bosqich vaqti darhol boshlanadi."}
          </p>
          {actionErr && <Alert tone="error">{actionErr}</Alert>}
        </div>
      </Modal>

      {/* conflict */}
      <Modal
        open={conflict}
        onClose={() => undefined}
        dismissable={false}
        title="Imtihon boshqa oynada ochiq"
        footer={
          <>
            <Link href="/kabinet" className="btn">
              Kabinetga chiqish
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                takeover.current = true;
                setConflict(false);
                void heartbeat();
              }}
            >
              Shu oynada davom ettirish
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Bu urinish boshqa brauzer oynasi yoki qurilmada faol. Javoblar ikki joydan bir vaqtda yozilsa, ular bir-birini almashtirib yuborishi mumkin. Shu
          oynada davom ettirsangiz, boshqa oyna avtomatik to‘xtatiladi.
        </p>
      </Modal>

      {/* section changed notice */}
      <Modal
        open={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ""}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setNotice(null)}>
            Tushunarli
          </button>
        }
      >
        <p className="text-sm text-ink-2">{notice?.body}</p>
      </Modal>
    </div>
  );
}
