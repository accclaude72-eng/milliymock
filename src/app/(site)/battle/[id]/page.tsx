"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { OptionList, type PublicQuestion, QuestionStem } from "@/components/question-view";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { useLive } from "@/components/use-live";
import { api, errorText } from "@/lib/api";
import { cx, fmtClock } from "@/lib/format-utils";

interface Q {
  position: number;
  topic: string | null;
  stem: string;
  options: { letter: string; html: string }[];
}
interface View {
  id: string;
  mode: "random" | "friend" | "code";
  subjectCode: string;
  status: "waiting" | "active" | "finished" | "cancelled" | "expired";
  inviteCode: string | null;
  isCreator: boolean;
  isInvited: boolean;
  questionCount: number;
  secPerQuestion: number;
  startedAt: number | null;
  deadline: number | null;
  serverNow: number;
  winnerId: string | null;
  me: string;
  players: {
    id: string;
    name: string;
    answered: number;
    correct: number | null;
    durationMs: number | null;
    done: boolean;
  }[];
  questions: Q[];
  mine: {
    position: number;
    ok: boolean | null;
    picked: string | null;
    correct: string | null;
  }[];
}

const asQ = (q: Q): PublicQuestion => ({
  id: String(q.position),
  n: q.position + 1,
  materialId: "",
  subjectCode: "",
  topic: q.topic,
  type: "Y1",
  stem: q.stem,
  options: q.options,
});

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Arena />}</RequireCandidate>
    </Suspense>
  );
}

function Arena() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { subjects } = useSubjects();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState<{ picked: string; ok: boolean | null } | null>(null);
  const [sending, setSending] = useState(false);
  const skew = useRef(0);

  const load = useCallback(
    () =>
      api<View>(`/api/battles/${id}`)
        .then((d) => {
          skew.current = d.serverNow - Date.now();
          setV(d);
        })
        .catch((e) => setErr(errorText(e))),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  const live = v && (v.status === "waiting" || v.status === "active");
  // Opponent progress and the start arrive over Realtime; polling covers a dropped socket.
  useLive(
    live ? `battle:${id}` : null,
    [
      { table: "battles", filter: `id=eq.${id}` },
      { table: "battle_participants", filter: `battle_id=eq.${id}` },
    ],
    load,
    4000,
  );

  // Clock (server-synced). Reload at the start and at the deadline.
  const phase = useRef("");
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => {
      const n = Date.now() + skew.current;
      setNow(n);
      const p = v.startedAt && n < v.startedAt ? "countdown" : v.deadline && n > v.deadline + 1500 ? "over" : "run";
      if (phase.current && phase.current !== p) load();
      phase.current = p;
    }, 250);
    return () => window.clearInterval(t);
  }, [live, v, load]);

  const answer = async (q: Q, letter: string) => {
    if (sending || flash) return;
    setSending(true);
    setFlash({ picked: letter, ok: null }); // show the choice at once; the verdict follows
    try {
      const r = await api<{ ok: boolean; done: boolean }>(`/api/battles/${id}`, {
        method: "POST",
        body: { action: "answer", position: q.position, letter },
      });
      setFlash({ picked: letter, ok: r.ok });
      // Keep the verdict on screen until the next question has arrived (no double answers meanwhile).
      await Promise.all([new Promise((res) => window.setTimeout(res, 600)), load()]);
    } catch (e) {
      setErr(errorText(e));
      await load();
    } finally {
      setFlash(null);
      setSending(false);
    }
  };

  const act = async (action: "cancel" | "join") => {
    setErr(null);
    try {
      await api(`/api/battles/${id}`, { method: "POST", body: { action } });
      if (action === "cancel") router.push("/battle");
      else load();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  if (err && !v)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">
          {err} <Link href="/battle">Battle sahifasiga qaytish</Link>
        </Alert>
      </div>
    );
  if (!v) return <PageLoader />;

  const me = v.players.find((p) => p.id === v.me);
  const opp = v.players.find((p) => p.id !== v.me);
  const subjectName = v.subjectCode === "mixed" ? "Aralash fanlar" : (subjects?.find((s) => s.code === v.subjectCode)?.name ?? v.subjectCode);

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/battle" className="text-sm text-muted">
        ← Battle
      </Link>
      <span className="chip chip-accent">{subjectName}</span>
      <span className="chip chip-ink">{v.questionCount} savol</span>
    </div>
  );

  /* ---------------------------------------------------------- closed without a game */
  if (v.status === "cancelled" || v.status === "expired")
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {header}
        <div className="sheet-hard mt-6 p-8 text-center">
          <p className="display text-3xl">{v.status === "cancelled" ? "Battle bekor qilindi" : "Hech kim qo‘shilmadi"}</p>
          <Link href="/battle" className="btn btn-primary mt-6">
            Yangi battle
          </Link>
        </div>
      </div>
    );

  /* ---------------------------------------------------------- invited, not yet joined */
  if (v.isInvited)
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {header}
        <div className="sheet-hard mt-6 p-8 text-center">
          <p className="display text-3xl">{v.players[0]?.name} sizni chaqirdi</p>
          {err && (
            <Alert tone="error" className="mt-4">
              {err}
            </Alert>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" className="btn" onClick={() => act("cancel")}>
              Rad etish
            </button>
            <button type="button" className="btn btn-primary" onClick={() => act("join")}>
              Qabul qilish ⚔
            </button>
          </div>
        </div>
      </div>
    );

  /* ---------------------------------------------------------- lobby */
  if (v.status === "waiting")
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {header}
        <div className="sheet-hard mt-6 p-8 text-center">
          <Spinner className="mx-auto" />
          <p className="display mt-4 text-3xl">{v.mode === "random" ? "Raqib izlanmoqda…" : v.mode === "friend" ? "Do‘stingiz kutilmoqda…" : "Raqib kutilmoqda…"}</p>
          {v.inviteCode && (
            <div className="mt-6">
              <p className="text-sm text-muted">Bu kodni raqibingizga yuboring — u “Battle” sahifasida kiritadi:</p>
              <p className="num mt-2 select-all text-5xl font-semibold tracking-[0.2em]">{v.inviteCode}</p>
              <button type="button" className="btn btn-sm mt-3" onClick={() => navigator.clipboard?.writeText(v.inviteCode!).catch(() => undefined)}>
                Nusxa olish
              </button>
            </div>
          )}
          <p className="mt-6 text-xs text-muted">10 daqiqa ichida hech kim qo‘shilmasa, battle yopiladi.</p>
          {v.isCreator && (
            <button type="button" className="btn btn-ghost mt-4" onClick={() => act("cancel")}>
              Bekor qilish
            </button>
          )}
        </div>
      </div>
    );

  /* ---------------------------------------------------------- result */
  if (v.status === "finished") {
    const outcome = v.winnerId === null ? "draw" : v.winnerId === v.me ? "win" : "loss";
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {header}
        <div className="sheet-hard crop mt-6 p-6 text-center sm:p-8">
          <p className="display animate-rise text-5xl">{outcome === "win" ? "G‘alaba! 🏆" : outcome === "draw" ? "Durang 🤝" : "Bu safar raqib kuchli 💪"}</p>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div>
              <p className="truncate font-semibold">{me?.name} (siz)</p>
              <p className="num text-6xl font-semibold">{me?.correct ?? 0}</p>
            </div>
            <span className="num text-2xl text-muted">:</span>
            <div>
              <p className="truncate font-semibold">{opp?.name ?? "—"}</p>
              <p className="num text-6xl font-semibold">{opp?.correct ?? 0}</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">{v.questionCount} savoldan to‘g‘ri javoblar · teng bo‘lsa tezroq tugatgan yutadi</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/battle" className="btn btn-primary">
              Yana battle
            </Link>
            <Link href="/reyting" className="btn">
              Reyting
            </Link>
          </div>
        </div>
        <h2 className="display mt-10 text-3xl">Javoblar tahlili</h2>
        <ol className="mt-4 space-y-4">
          {v.questions.map((q) => {
            const m = v.mine.find((x) => x.position === q.position);
            return (
              <li key={q.position} className="sheet p-4">
                <p className="eyebrow">
                  {q.position + 1}-savol {m?.picked == null ? "· javobsiz" : m.ok ? "· ✓ to‘g‘ri" : "· ✗ noto‘g‘ri"}
                </p>
                <QuestionStem q={asQ(q)} className="mt-2" />
                <OptionList q={asQ(q)} correct={m?.correct ?? null} wrong={m?.picked && !m.ok ? m.picked : null} />
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  /* ---------------------------------------------------------- running */
  const counting = v.startedAt != null && now > 0 && now < v.startedAt;
  const left = v.deadline ? Math.max(0, v.deadline - now) : 0;
  const q = v.questions[0];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {header}
      <div className="sticky top-16 z-10 -mx-4 mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-hair bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[3px] sm:border">
        <Progress p={me} mine total={v.questionCount} />
        <span className={cx("num chip !text-base", left < 20_000 ? "chip-accent animate-pulse" : "chip-ink")} aria-live="polite">
          ⏱ {fmtClock(left)}
        </span>
        <Progress p={opp} total={v.questionCount} />
      </div>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {counting || now === 0 ? (
        <div className="sheet-hard mt-6 p-10 text-center">
          <p className="eyebrow">Raqib topildi: {opp?.name}</p>
          <p key={Math.ceil(((v.startedAt ?? 0) - now) / 1000)} className="num display animate-rise mt-4 text-8xl">
            {Math.max(1, Math.ceil(((v.startedAt ?? 0) - now) / 1000))}
          </p>
        </div>
      ) : q ? (
        <section className={cx("sheet-hard mt-6 p-5 transition-colors sm:p-6", flash && flash.ok !== null && (flash.ok ? "border-ok" : "border-accent"))}>
          <p className="eyebrow">
            {q.position + 1}/{v.questionCount}
            {q.topic ? ` · ${q.topic}` : ""}
          </p>
          <QuestionStem q={asQ(q)} className="mt-3" />
          <OptionList
            q={asQ(q)}
            picked={flash?.picked ?? null}
            wrong={flash && flash.ok === false ? flash.picked : null}
            correct={flash?.ok === true ? flash.picked : null}
            onPick={(L) => answer(q, L)}
            disabled={sending || !!flash}
          />
          <p className="mt-4 text-center text-xs text-muted">Javob bir marta tanlanadi va o‘zgartirilmaydi. Keyingi savolga avtomatik o‘tiladi.</p>
        </section>
      ) : (
        <div className="sheet-hard mt-6 p-10 text-center">
          <p className="display text-3xl">Siz tugatdingiz ✓</p>
          <p className="mt-2 text-muted">{opp?.done ? "Natija hisoblanmoqda…" : `${opp?.name ?? "Raqib"} hali yechmoqda — natija ikkalangiz tugatgach yoki vaqt tugaganda chiqadi.`}</p>
          <Spinner className="mx-auto mt-4" />
        </div>
      )}
    </div>
  );
}

function Progress({ p, mine, total }: { p?: View["players"][number]; mine?: boolean; total: number }) {
  return (
    <div className={cx("sheet p-3", mine && "border-ink")}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-semibold">{p ? (mine ? `${p.name} (siz)` : p.name) : "—"}</span>
        <span className="num text-muted">
          {p?.answered ?? 0}/{total}
          {p?.done ? " ✓" : ""}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
        <div className={cx("h-full transition-all duration-500", mine ? "bg-ink" : "bg-accent")} style={{ width: `${((p?.answered ?? 0) / total) * 100}%` }} />
      </div>
    </div>
  );
}
