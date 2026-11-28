"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { OptionList, type PublicQuestion, QuestionStem } from "@/components/question-view";
import { Alert, EmptyState, PageLoader, Spinner, Stat } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx, fmtDate } from "@/lib/format-utils";

interface Item {
  id: number;
  question: PublicQuestion;
  materialTitle: string;
  correctAnswer: string | null;
  explanation: string | null;
  lastAnswer: string | null;
  wrongCount: number;
  correctStreak: number;
  status: "open" | "understood" | "resolved";
  bookmarked: boolean;
  note: string;
  reviewStage: number;
  nextReviewAt: number;
  due: boolean;
  lastWrongAt: number;
}
interface Data {
  items: Item[];
  stats: { total: number; resolved: number; understood: number; open: number; due: number; bySubject: Record<string, { total: number; open: number }>; mostRepeated: number[] };
}

const FILTERS = [
  ["due", "Takrorlash vaqti keldi"],
  ["open", "Ochiq"],
  ["understood", "Tushunilgan"],
  ["resolved", "Hal qilingan"],
  ["bookmarked", "Belgilangan"],
  ["all", "Hammasi"],
] as const;
const STATUS = { open: ["Ochiq", "chip-accent"], understood: ["Tushunilgan", "chip-info"], resolved: ["Hal qilingan", "chip-ok"] } as const;

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Notebook />}</RequireCandidate>
    </Suspense>
  );
}

function Card({ it, onPatch }: { it: Item; onPatch: (id: number, p: Partial<Pick<Item, "bookmarked" | "note" | "status">>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(it.note);
  const [busy, setBusy] = useState(false);
  const save = async (p: Partial<Pick<Item, "bookmarked" | "note" | "status">>) => {
    setBusy(true);
    await onPatch(it.id, p).finally(() => setBusy(false));
  };
  const [label, chip] = STATUS[it.status];
  return (
    <li className="sheet p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cx("chip", chip)}>{label}</span>
        {it.due && <span className="chip chip-warn">Takrorlash vaqti</span>}
        <span className="chip chip-ink">{it.question.topic ?? "Mavzusiz"}</span>
        <span className="text-muted">
          {it.materialTitle} · {it.question.n}-savol
        </span>
        <button
          type="button"
          className={cx("ml-auto text-lg leading-none", it.bookmarked ? "text-warn" : "text-muted hover:text-ink")}
          aria-pressed={it.bookmarked}
          aria-label={it.bookmarked ? "Belgini olib tashlash" : "Belgilash"}
          disabled={busy}
          onClick={() => save({ bookmarked: !it.bookmarked })}
        >
          {it.bookmarked ? "★" : "☆"}
        </button>
      </div>
      <QuestionStem q={it.question} className="mt-3" />
      {it.question.type === "Y1" ? (
        <OptionList q={it.question} correct={it.correctAnswer} wrong={it.lastAnswer && it.lastAnswer !== it.correctAnswer ? it.lastAnswer.toUpperCase() : null} />
      ) : (
        <p className="mt-3 text-sm">
          Sizning javobingiz: <b className="text-accent-ink">{it.lastAnswer || "— (javobsiz)"}</b>
          {it.correctAnswer && (
            <>
              {" "}
              · To‘g‘ri javob: <b className="text-ok">{it.correctAnswer}</b>
            </>
          )}
        </p>
      )}
      {!it.correctAnswer && <p className="mt-2 text-xs text-muted">Bu test to‘g‘ri javoblarni ko‘rsatmaydi — mashqda o‘zingizni tekshirib ko‘ring.</p>}
      {it.explanation && <p className="mt-3 border-l-[3px] border-ok pl-3 text-sm text-ink-2">{it.explanation}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.68rem] text-muted">
        <span>{it.wrongCount}× xato</span>
        <span>ketma-ket to‘g‘ri: {it.correctStreak}/3</span>
        <span>oxirgi xato: {fmtDate(it.lastWrongAt)}</span>
        {it.status !== "resolved" && <span>keyingi takrorlash: {fmtDate(it.nextReviewAt)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {it.status !== "resolved" && (
          <Link href={`/kabinet/mashq?mode=mistakes&ids=${it.id}`} className="btn btn-sm btn-primary">
            Qayta yechish
          </Link>
        )}
        {it.status === "open" && (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save({ status: "understood" })}>
            ✓ Tushundim
          </button>
        )}
        {it.status === "understood" && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => save({ status: "open" })}>
            Ochiqqa qaytarish
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          ✎ Izoh{it.note ? " (bor)" : ""}
        </button>
        {busy && <Spinner />}
      </div>
      {open && (
        <div className="mt-3">
          <textarea className="field min-h-20 text-sm" maxLength={2000} value={note} placeholder="Bu savol bo‘yicha o‘zingiz uchun eslatma…" onChange={(e) => setNote(e.target.value)} aria-label="Shaxsiy izoh" />
          <button type="button" className="btn btn-sm mt-2" disabled={busy || note === it.note} onClick={() => save({ note })}>
            Saqlash
          </button>
        </div>
      )}
    </li>
  );
}

function Notebook() {
  const { subjects } = useSubjects();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("open");
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Data>("/api/me/mistakes")
      .then((x) => {
        setD(x);
        if (x.stats.due > 0) setFilter("due");
      })
      .catch((e) => setErr(errorText(e)));
  }, []);

  const patch = async (id: number, p: Partial<Pick<Item, "bookmarked" | "note" | "status">>) => {
    try {
      await api(`/api/me/mistakes/${id}`, { method: "PATCH", body: p });
      setD((cur) => cur && { ...cur, items: cur.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const shown = useMemo(() => {
    if (!d) return [];
    const text = q.trim().toLowerCase();
    return d.items.filter((i) => {
      if (subject !== "all" && i.question.subjectCode !== subject) return false;
      if (filter === "due" && !i.due) return false;
      if ((filter === "open" || filter === "understood" || filter === "resolved") && i.status !== filter) return false;
      if (filter === "bookmarked" && !i.bookmarked) return false;
      if (text && !`${i.question.stem} ${i.question.topic ?? ""} ${i.note}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [d, filter, subject, q]);

  const subjectName = (code: string) => subjects?.find((s) => s.code === code)?.name ?? code;
  const hardest = d ? Object.entries(d.stats.bySubject).sort((a, b) => b[1].open - a[1].open).slice(0, 3) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shaxsiy</p>
          <h1 className="display mt-1 text-4xl sm:text-5xl">Xatolar daftari</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            E’lon qilingan imtihonlaringizdagi xato va javobsiz savollar shu yerga avtomatik tushadi. 1 → 3 → 7 → 14 kun oralig‘ida takrorlang; ketma-ket 3 marta to‘g‘ri yechsangiz, xato
            “hal qilingan” bo‘ladi.
          </p>
        </div>
        {d && d.stats.due > 0 && (
          <Link href="/kabinet/mashq?mode=mistakes&due=1&count=20" className="btn btn-primary">
            Bugungi takrorlash ({d.stats.due}) →
          </Link>
        )}
      </div>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {!d && !err && <PageLoader />}
      {d && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Jami xatolar" value={d.stats.total} />
            <Stat label="Ochiq" value={d.stats.open} tone="accent" />
            <Stat label="Hal qilingan" value={d.stats.resolved} tone="ok" />
            <Stat label="Bugun takrorlash" value={d.stats.due} />
          </div>
          {hardest.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Eng ko‘p ochiq xato: {hardest.map(([c, s]) => `${subjectName(c)} (${s.open})`).join(", ")}
              {d.stats.mostRepeated.length > 0 && ` · ${d.stats.mostRepeated.length} ta savolda bir necha marta xato qilgansiz`}
            </p>
          )}

          {d.stats.total === 0 ? (
            <div className="mt-8">
              <EmptyState title="Xatolar yo‘q" action={<Link href="/imtihonlar" className="btn btn-primary">Mock topshirish</Link>}>
                Imtihon natijangiz e’lon qilingach, xato javoblaringiz shu yerda paydo bo‘ladi.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
                  {FILTERS.map(([k, l]) => (
                    <button key={k} type="button" className={cx("btn btn-sm shrink-0", filter === k && "btn-ink")} onClick={() => setFilter(k)}>
                      {l}
                    </button>
                  ))}
                </div>
                <select className="field !min-h-9 max-w-48 !py-1 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Fan">
                  <option value="all">Barcha fanlar</option>
                  {Object.keys(d.stats.bySubject).map((c) => (
                    <option key={c} value={c}>
                      {subjectName(c)}
                    </option>
                  ))}
                </select>
                <input type="search" className="field !min-h-9 max-w-56 !py-1 text-sm" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
                {shown.some((i) => i.status !== "resolved") && (
                  <Link
                    href={`/kabinet/mashq?mode=mistakes&ids=${shown
                      .filter((i) => i.status !== "resolved")
                      .slice(0, 50)
                      .map((i) => i.id)
                      .join(",")}&count=50`}
                    className="btn btn-sm btn-primary ml-auto"
                  >
                    Shularni mashq qilish
                  </Link>
                )}
              </div>
              {shown.length === 0 ? (
                <p className="mt-6 text-sm text-muted">Bu filtr bo‘yicha xato topilmadi.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {shown.map((it) => (
                    <Card key={it.id} it={it} onPatch={patch} />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
