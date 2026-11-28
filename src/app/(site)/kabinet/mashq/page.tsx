"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { OptionList, type PublicQuestion, QuestionStem } from "@/components/question-view";
import { Alert, EmptyState, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";

interface Session {
  sessionId: string;
  mode: "mistakes" | "bank";
  questions: PublicQuestion[];
}
interface Check {
  correct: boolean;
  correctAnswer: string | null;
  explanation: string | null;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <PracticeRoot />}</RequireCandidate>
    </Suspense>
  );
}

function PracticeRoot() {
  const sp = useSearchParams();
  const query = sp.toString();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <CabinetNav />
      {query ? <Practice key={query} query={query} /> : <Picker />}
    </div>
  );
}

/** Start screen: choose what to practise. */
function Picker() {
  const { subjects } = useSubjects();
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(10);
  const base = `subject=${subject}&count=${count}`;
  return (
    <>
      <p className="eyebrow">Mashq</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Mashq qilish</h1>
      <p className="mt-2 text-sm text-muted">Savollar e’lon qilingan haqiqiy testlardan olinadi. Javobingiz serverda tekshiriladi; xatolar daftaringizga avtomatik tushadi.</p>
      <div className="sheet mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ps">
            Fan
          </label>
          <select id="ps" className="field" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Barcha fanlar</option>
            {(subjects ?? [])
              .filter((s) => s.code !== "multilevel")
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pc">
            Savollar soni
          </label>
          <select id="pc" className="field" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href={`/kabinet/mashq?mode=mistakes&due=1&${base}`} className="sheet lift p-4">
          <p className="text-2xl">⏰</p>
          <p className="mt-2 font-semibold">Bugungi takrorlash</p>
          <p className="text-xs text-muted">Vaqti kelgan xatolar</p>
        </Link>
        <Link href={`/kabinet/mashq?mode=mistakes&${base}`} className="sheet lift p-4">
          <p className="text-2xl">✎</p>
          <p className="mt-2 font-semibold">Barcha xatolarim</p>
          <p className="text-xs text-muted">Hal qilinmagan xatolar</p>
        </Link>
        <Link href={`/kabinet/mashq?mode=bank&${base}`} className="sheet lift p-4">
          <p className="text-2xl">🎲</p>
          <p className="mt-2 font-semibold">Aralash savollar</p>
          <p className="text-xs text-muted">Savollar bazasidan tasodifiy</p>
        </Link>
      </div>
    </>
  );
}

function Practice({ query }: { query: string }) {
  const [s, setS] = useState<Session | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState("");
  const [checking, setChecking] = useState(false);
  const [res, setRes] = useState<Check | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  useEffect(() => {
    api<Session>(`/api/me/practice?${query}`)
      .then(setS)
      .catch((e) => setErr(errorText(e)));
  }, [query]);

  const q = s?.questions[i];
  const submit = useCallback(async () => {
    if (!s || !q || !pick.trim() || checking || res) return;
    setChecking(true);
    setErr(null);
    try {
      const r = await api<Check>("/api/me/practice", { method: "POST", body: { sessionId: s.sessionId, questionId: q.id, answer: pick.trim() } });
      setRes(r);
      setScore((x) => ({ right: x.right + (r.correct ? 1 : 0), total: x.total + 1 }));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setChecking(false);
    }
  }, [s, q, pick, checking, res]);

  const next = () => {
    setI((x) => x + 1);
    setPick("");
    setRes(null);
  };

  // Keyboard: A–D picks, Enter checks / continues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const L = e.key.toUpperCase();
      if (!res && q.type === "Y1" && q.options.some((o) => o.letter === L)) setPick(L);
      if (e.key !== "Enter") return;
      if (res) next();
      else submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (err && !s) return <Alert tone="error">{err}</Alert>;
  if (!s) return <PageLoader />;
  if (!s.questions.length)
    return (
      <EmptyState title={s.mode === "mistakes" ? "Takrorlanadigan xato yo‘q" : "Savol topilmadi"} action={<Link href="/kabinet/mashq" className="btn">Boshqa mashq tanlash</Link>}>
        {s.mode === "mistakes" ? "Barcha xatolaringiz hal qilingan yoki takrorlash vaqti hali kelmagan. Zo‘r!" : "Bu fan yoki mavzu bo‘yicha javoblari ochiq savollar hali yo‘q."}
      </EmptyState>
    );

  if (!q)
    return (
      <div className="sheet-hard crop p-8 text-center">
        <p className="eyebrow">Mashq yakunlandi</p>
        <p className="num mt-3 text-6xl font-semibold">
          {score.right}/{score.total}
        </p>
        <p className="mt-2 text-muted">{score.total ? `${Math.round((score.right / score.total) * 100)}% to‘g‘ri` : ""}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/kabinet/xatolar" className="btn">
            Xatolar daftari
          </Link>
          <Link href="/kabinet/mashq" className="btn btn-primary">
            Yangi mashq
          </Link>
        </div>
      </div>
    );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{s.mode === "mistakes" ? "Xatolarni takrorlash" : "Mashq"}</p>
        <p className="num text-sm">
          {i + 1}/{s.questions.length} · <span className="text-ok">{score.right} to‘g‘ri</span>
        </p>
      </div>
      <div className="mt-2">
        <ProgressBar value={i} max={s.questions.length} tone="accent" />
      </div>
      <section className="sheet-hard mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2 text-xs">
          {q.topic && <span className="chip chip-ink">{q.topic}</span>}
          <span className="chip chip-info">{q.type === "Y1" ? "Bitta to‘g‘ri javob" : "Qisqa javob"}</span>
        </div>
        <QuestionStem q={q} className="mt-4" />
        {q.type === "Y1" ? (
          <OptionList q={q} picked={pick} disabled={!!res} correct={res?.correctAnswer ?? (res?.correct ? pick : null)} wrong={res && !res.correct ? pick : null} onPick={setPick} />
        ) : (
          <input
            className={cx("field mt-4 max-w-sm", res && (res.correct ? "!border-ok" : "!border-accent"))}
            value={pick}
            disabled={!!res}
            maxLength={100}
            placeholder="Javobingiz"
            onChange={(e) => setPick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-label="Javob"
            autoFocus
          />
        )}
        {res && (
          <div className={cx("mt-4 rounded-[3px] border px-4 py-3 text-sm", res.correct ? "border-ok bg-ok-soft" : "border-accent bg-accent-soft")} role="status">
            <b>{res.correct ? "✓ To‘g‘ri!" : "✗ Noto‘g‘ri."}</b>
            {!res.correct && res.correctAnswer && (
              <>
                {" "}
                To‘g‘ri javob: <b>{res.correctAnswer}</b>
              </>
            )}
            {!res.correct && !res.correctAnswer && " Bu test javoblarni ko‘rsatmaydi — xato daftaringizda qoldi."}
            {res.explanation && <p className="mt-2 text-ink-2">{res.explanation}</p>}
          </div>
        )}
        {err && (
          <Alert tone="error" className="mt-4">
            {err}
          </Alert>
        )}
        <div className="mt-5 flex justify-end">
          {res ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              {i + 1 < s.questions.length ? "Keyingisi →" : "Yakunlash"}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!pick.trim() || checking} onClick={submit}>
              {checking && <Spinner />} Tekshirish
            </button>
          )}
        </div>
      </section>
      <p className="mt-3 text-center font-mono text-[0.65rem] text-muted">Klaviatura: A–D tanlash · Enter tekshirish / keyingisi</p>
    </>
  );
}
