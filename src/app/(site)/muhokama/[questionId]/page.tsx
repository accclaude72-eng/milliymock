"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { OptionList, type PublicQuestion, QuestionStem } from "@/components/question-view";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";

interface Post {
  id: string;
  name: string;
  body: string;
  at: number;
  edited: boolean;
  mine: boolean;
  canEdit: boolean;
  votes: number;
  voted: boolean;
}
interface Data {
  question: PublicQuestion & { material: string; correct: string | null };
  threads: (Post & { replies: Post[] })[];
}

const REASONS = [
  ["spam", "Spam / reklama"],
  ["abuse", "Haqorat"],
  ["wrong", "Noto‘g‘ri ma’lumot"],
  ["spoiler", "Boshqa testning javobi"],
  ["other", "Boshqa"],
] as const;

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Discussion />}</RequireCandidate>
    </Suspense>
  );
}

function Discussion() {
  const { questionId } = useParams<{ questionId: string }>();
  const qid = decodeURIComponent(questionId);
  const path = `/api/discussions/${encodeURIComponent(qid)}`;
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<Data>(path)
        .then(setD)
        .catch((e) => {
          if ((e as { status?: number }).status === 403) setLocked(true);
          setErr(errorText(e));
        }),
    [path],
  );
  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>, ok?: string) => {
    setErr(null);
    setNote(null);
    try {
      await api(path, { method: "POST", body });
      if (ok) setNote(ok);
      await load();
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    }
  };

  if (!d)
    return err ? (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone={locked ? "info" : "error"} title={locked ? "Muhokama hali yopiq" : undefined}>
          {err} <Link href="/kabinet/xatolar">Xatolar daftariga qaytish</Link>
        </Alert>
      </div>
    ) : (
      <PageLoader />
    );

  const q = d.question;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/kabinet/xatolar" className="text-sm text-muted">
        ← Xatolar daftari
      </Link>
      <section className="sheet-hard mt-3 p-5">
        <p className="eyebrow">
          {q.material} · {q.n}-savol {q.topic ? `· ${q.topic}` : ""}
        </p>
        <QuestionStem q={q} className="mt-2" />
        {q.options.length > 0 && <OptionList q={q} correct={q.correct} />}
        {!q.correct && <p className="mt-3 text-xs text-muted">Bu test uchun to‘g‘ri javoblar hali ochilmagan.</p>}
      </section>

      <h1 className="display mt-8 text-3xl">Muhokama · {d.threads.length}</h1>
      <p className="mt-1 text-sm text-muted">Yechim usulini tushuntiring, savol bering. Hurmat bilan yozing — haqorat va spam yashiriladi.</p>
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

      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await post({ action: "thread", body: text.trim() })) setText("");
          setBusy(false);
        }}
      >
        <textarea className="field" rows={3} maxLength={2000} placeholder="Fikringiz yoki savolingiz…" aria-label="Yangi xabar" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary mt-2" disabled={busy || text.trim().length < 2}>
          {busy && <Spinner />} Yuborish
        </button>
      </form>

      <ol className="mt-6 space-y-4">
        {d.threads.length === 0 && <li className="text-sm text-muted">Hali hech kim yozmagan. Birinchi bo‘ling!</li>}
        {d.threads.map((t) => (
          <li key={t.id} className="sheet p-4">
            <PostView p={t} type="thread" post={post} />
            {t.replies.length > 0 && (
              <ol className="mt-3 space-y-3 border-l-2 border-hair pl-4">
                {t.replies.map((r) => (
                  <li key={r.id}>
                    <PostView p={r} type="reply" post={post} />
                  </li>
                ))}
              </ol>
            )}
            <ReplyForm onSend={(body) => post({ action: "reply", threadId: t.id, body })} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function PostView({ p, type, post }: { p: Post; type: "thread" | "reply"; post: (b: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(p.body);
  const [reporting, setReporting] = useState(false);
  return (
    <div>
      <p className="text-xs text-muted">
        <b className="text-ink">{p.mine ? `${p.name} (siz)` : p.name}</b> · {fmtDateTime(p.at)}
        {p.edited && " · tahrirlangan"}
      </p>
      {editing ? (
        <form
          className="mt-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post({ action: "edit", type, id: p.id, body: val.trim() })) setEditing(false);
          }}
        >
          <textarea className="field text-sm" rows={3} maxLength={2000} value={val} onChange={(e) => setVal(e.target.value)} aria-label="Xabarni tahrirlash" />
          <div className="mt-1 flex gap-2">
            <button className="btn btn-sm btn-primary">Saqlash</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
              Bekor
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{p.body}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          disabled={p.mine}
          onClick={() => post({ action: "vote", type, id: p.id })}
          className={cx("chip", p.voted ? "chip-ok" : "", p.mine && "opacity-60")}
          aria-pressed={p.voted}
        >
          👍 Foydali · {p.votes}
        </button>
        {p.canEdit && !editing && (
          <button type="button" className="text-muted hover:text-ink" onClick={() => setEditing(true)}>
            tahrirlash
          </button>
        )}
        {p.mine && (
          <button type="button" className="text-muted hover:text-accent" onClick={() => window.confirm("Xabaringiz o‘chirilsinmi?") && post({ action: "remove", type, id: p.id })}>
            o‘chirish
          </button>
        )}
        {!p.mine &&
          (reporting ? (
            <span className="flex flex-wrap gap-1">
              {REASONS.map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  onClick={async () => (await post({ action: "report", type, id: p.id, reason: r, note: null }, "Rahmat! Moderator ko‘rib chiqadi.")) && setReporting(false)}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="text-muted" onClick={() => setReporting(false)}>
                ✕
              </button>
            </span>
          ) : (
            <button type="button" className="text-muted hover:text-accent" onClick={() => setReporting(true)}>
              ⚑ shikoyat
            </button>
          ))}
      </div>
    </div>
  );
}

function ReplyForm({ onSend }: { onSend: (body: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (!open)
    return (
      <button type="button" className="mt-3 text-xs font-medium text-accent" onClick={() => setOpen(true)}>
        Javob yozish
      </button>
    );
  return (
    <form
      className="mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSend(val.trim())) {
          setVal("");
          setOpen(false);
        }
      }}
    >
      <textarea className="field text-sm" rows={2} maxLength={2000} autoFocus value={val} onChange={(e) => setVal(e.target.value)} aria-label="Javob" />
      <div className="mt-1 flex gap-2">
        <button className="btn btn-sm btn-primary" disabled={val.trim().length < 2}>
          Yuborish
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
          Bekor
        </button>
      </div>
    </form>
  );
}
