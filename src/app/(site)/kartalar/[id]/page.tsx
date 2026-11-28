"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";
import { precachePage, saveDeck } from "@/lib/offline-cards";
import { type CardState, GRADES, previewIntervals } from "@/lib/sm2";

interface Card {
  id: string;
  front: string;
  back: string;
  html: boolean;
  isNew: boolean;
  state: CardState;
}
interface Data {
  deck: { id: string; title: string; description: string | null; subjectCode: string | null; source: string; own: boolean; editable: boolean };
  queue: Card[];
  cards: { id: string; front: string; back: string }[];
}

const days = (n: number) => (n <= 1 ? "1 kun" : n < 30 ? `${n} kun` : n < 365 ? `${Math.round(n / 30)} oy` : `${Math.round(n / 365)} yil`);

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Deck />}</RequireCandidate>
    </Suspense>
  );
}

function Face({ text, html }: { text: string; html: boolean }) {
  return html ? <div className="text-lg [&_li]:mt-1 [&_ul]:mt-3 [&_ul]:space-y-1" dangerouslySetInnerHTML={{ __html: text }} /> : <p className="whitespace-pre-wrap text-lg">{text}</p>;
}

function Deck() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"study" | "edit">(sp.get("tahrir") ? "edit" : "study");
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<Data>(`/api/flashcards/${id}`)
        .then((x) => {
          setD(x);
          setI(0);
          setFlipped(false);
        })
        .catch((e) => setErr(errorText(e))),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  const card = d?.queue[i];
  const grade = async (g: number) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await api("/api/flashcards/review", { method: "POST", body: { cardId: card.id, grade: g } });
      setDone((n) => n + 1);
      setFlipped(false);
      setI((n) => n + 1);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Keyboard: space flips, 1–4 grade.
  useEffect(() => {
    if (tab !== "study") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade(GRADES[Number(e.key) - 1].grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const post = async (body: Record<string, unknown>, ok?: string) => {
    setErr(null);
    setNote(null);
    try {
      const r = await api<{ added?: number }>(`/api/flashcards/${id}`, { method: "POST", body });
      if (body.action === "delete_deck") return router.push("/kartalar");
      setNote(r.added ? `${r.added} ta karta qo‘shildi.` : (ok ?? null));
      await load();
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    }
  };

  if (err && !d)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error">
          {err} <Link href="/kartalar">To‘plamlarga qaytish</Link>
        </Alert>
      </div>
    );
  if (!d) return <PageLoader />;

  const left = d.queue.length - i;
  const preview = card ? previewIntervals(card.state) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/kartalar" className="text-sm text-muted">
        ← To‘plamlar
      </Link>
      <h1 className="display mt-2 text-4xl">{d.deck.title}</h1>
      {d.deck.description && <p className="mt-1 text-sm text-muted">{d.deck.description}</p>}
      {d.queue.length > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-ghost mt-2"
          onClick={() => {
            const okSaved = saveDeck({ id: d.deck.id, title: d.deck.title, savedAt: Date.now(), cards: d.queue.map((c) => ({ id: c.id, front: c.front, back: c.back, html: c.html })) });
            if (okSaved) void precachePage("/kartalar/oflayn");
            setNote(okSaved ? `Bugungi ${d.queue.length} ta karta shu qurilmaga saqlandi — internetsiz ham “Oflayn kartalar” sahifasida takrorlashingiz mumkin.` : null);
            if (!okSaved) setErr("Qurilma xotirasiga saqlab bo‘lmadi.");
          }}
        >
          ⤓ Oflayn uchun saqlash
        </button>
      )}
      {d.deck.editable && (
        <div className="mt-4 flex gap-1 border-b border-hair" role="tablist">
          {(["study", "edit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx("border-b-2 px-3 py-2 text-sm font-medium", tab === t ? "border-accent" : "border-transparent text-muted")}
            >
              {t === "study" ? "Takrorlash" : `Kartalar (${d.cards.length})`}
            </button>
          ))}
        </div>
      )}
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

      {tab === "study" &&
        (card ? (
          <section className="mt-6">
            <p className="num text-sm text-muted">
              {left} ta qoldi · bugun {done} ta takrorlandi {card.isNew && <span className="chip chip-info ml-2">yangi</span>}
            </p>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="sheet-hard mt-3 block min-h-[260px] w-full p-6 text-left transition-transform active:scale-[0.99] sm:p-8"
              aria-label={flipped ? "Kartaning old tomoni" : "Javobni ko‘rsatish"}
            >
              <p className="eyebrow">{flipped ? "Javob" : "Savol"}</p>
              <div className="mt-3" key={flipped ? "b" : "f"}>
                <div className="animate-rise">
                  <Face text={card.front} html={card.html} />
                  {flipped && (
                    <div className="mt-5 border-t border-hair pt-5">
                      <Face text={card.back} html={card.html} />
                    </div>
                  )}
                </div>
              </div>
              {!flipped && <p className="mt-6 text-center text-xs text-muted">Javobni eslang, so‘ng bosing (yoki Probel tugmasi)</p>}
            </button>
            {flipped && preview && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((g, k) => (
                  <button
                    key={g.grade}
                    type="button"
                    disabled={busy}
                    onClick={() => grade(g.grade)}
                    className={cx("btn flex-col !py-2", g.grade === 1 ? "btn-primary" : g.grade === 5 ? "btn-ink" : "")}
                  >
                    <span className="font-semibold">
                      {k + 1}. {g.label}
                    </span>
                    <span className="text-xs opacity-80">{days(preview[g.grade])}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="sheet-hard mt-6 p-10 text-center">
            <p className="display text-3xl">{done ? "Bugungi takrorlash tugadi! 🎉" : "Bugun takrorlanadigan karta yo‘q"}</p>
            <p className="mt-2 text-muted">
              {done ? `${done} ta karta takrorlandi. Keyingilari o‘z vaqtida qaytadi.` : d.deck.editable ? "Kartalar qo‘shing yoki ertaga qayting." : "Ertaga qayting."}
            </p>
            <Link href="/kartalar" className="btn btn-primary mt-6">
              To‘plamlarga qaytish
            </Link>
          </div>
        ))}

      {tab === "edit" && d.deck.editable && (
        <section className="mt-6 space-y-6">
          <form
            className="sheet-hard p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await post({ action: "add", text: bulk })) setBulk("");
              setBusy(false);
            }}
          >
            <label className="label" htmlFor="bulk">
              Kartalar qo‘shish — har qatorda: savol | javob
            </label>
            <textarea
              id="bulk"
              className="field font-mono text-sm"
              rows={6}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Allel | genning muqobil shakli\nGenotip | organizmdagi genlar majmui"}
            />
            <button className="btn btn-primary mt-3" disabled={busy || !bulk.includes("|")}>
              {busy && <Spinner />} Qo‘shish
            </button>
          </form>
          <ul className="divide-y divide-hair border-y border-hair">
            {d.cards.length === 0 && <li className="py-4 text-sm text-muted">Hali karta yo‘q.</li>}
            {d.cards.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1 whitespace-pre-wrap font-medium">{c.front}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-muted">{c.back}</span>
                <button type="button" className="text-xs text-accent" onClick={() => post({ action: "delete_card", cardId: c.id })}>
                  o‘chirish
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.confirm("To‘plam va undagi barcha kartalar o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.") && post({ action: "delete_deck" })}
          >
            To‘plamni o‘chirish
          </button>
        </section>
      )}
    </div>
  );
}
