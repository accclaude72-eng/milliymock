"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { cx } from "@/lib/format-utils";
import { type OfflineDeck, pendingReviews, queueReview, removeDeck, savedDecks } from "@/lib/offline-cards";
import { GRADES } from "@/lib/sm2";

/**
 * Offline study of decks saved on this device. Works without login state and without
 * network: reviews are queued locally and sent by <PwaRegister> when the device is online.
 */
export default function OfflineCards() {
  const [decks, setDecks] = useState<OfflineDeck[] | null>(null);
  const [open, setOpen] = useState<OfflineDeck | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    // localStorage is only available in the browser — read after mount.
    const t = window.setTimeout(() => {
      setDecks(savedDecks());
      setPending(pendingReviews().length);
    }, 0);
    const refresh = () => setPending(pendingReviews().length);
    window.addEventListener("online", refresh);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", refresh);
    };
  }, []);

  const grade = (g: number) => {
    if (!open) return;
    queueReview({ cardId: open.cards[i].id, grade: g });
    setPending((n) => n + 1);
    setFlipped(false);
    setI((n) => n + 1);
  };

  if (open) {
    const card = open.cards[i];
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <button type="button" className="text-sm text-muted" onClick={() => setOpen(null)}>
          ← Oflayn to‘plamlar
        </button>
        <h1 className="display mt-2 text-4xl">{open.title}</h1>
        {card ? (
          <>
            <p className="num mt-3 text-sm text-muted">
              {i + 1}/{open.cards.length} · javoblar internet qaytganda yuboriladi
            </p>
            <button type="button" onClick={() => setFlipped((f) => !f)} className="sheet-hard mt-3 block min-h-[240px] w-full p-6 text-left">
              <p className="eyebrow">{flipped ? "Javob" : "Savol"}</p>
              {card.html ? <div className="mt-3 text-lg [&_li]:mt-1 [&_ul]:mt-3" dangerouslySetInnerHTML={{ __html: card.front }} /> : <p className="mt-3 whitespace-pre-wrap text-lg">{card.front}</p>}
              {flipped && (
                <div className="mt-5 border-t border-hair pt-5">
                  {card.html ? <div className="text-lg" dangerouslySetInnerHTML={{ __html: card.back }} /> : <p className="whitespace-pre-wrap text-lg">{card.back}</p>}
                </div>
              )}
            </button>
            {flipped && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((g) => (
                  <button key={g.grade} type="button" onClick={() => grade(g.grade)} className={cx("btn", g.grade === 1 && "btn-primary")}>
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="sheet-hard mt-6 p-10 text-center">
            <p className="display text-3xl">To‘plam tugadi 🎉</p>
            <p className="mt-2 text-muted">Javoblaringiz qurilmada saqlandi va internet qaytganda serverga yuboriladi.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Internetsiz takrorlash</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Oflayn kartalar</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Bu yerda faqat shu qurilmaga saqlangan to‘plamlar bor. Saqlash: Flashcards → to‘plam → “Oflayn uchun saqlash”.
        {pending > 0 && <b className="ml-1 text-ink">Yuborilishi kutilayotgan javoblar: {pending}.</b>}
      </p>
      {decks && decks.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Saqlangan to‘plam yo‘q"
            action={
              <Link href="/kartalar" className="btn btn-primary">
                Flashcards
              </Link>
            }
          >
            Internet bor paytda to‘plamni oflayn uchun saqlang.
          </EmptyState>
        </div>
      )}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {decks?.map((d) => (
          <li key={d.id} className="sheet-hard flex flex-col p-4">
            <h2 className="text-lg font-semibold">{d.title}</h2>
            <p className="num text-sm text-muted">
              {d.cards.length} ta karta · {new Date(d.savedAt).toLocaleDateString("uz-UZ")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!d.cards.length}
                onClick={() => {
                  setOpen(d);
                  setI(0);
                  setFlipped(false);
                }}
              >
                Takrorlash
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  removeDeck(d.id);
                  setDecks(savedDecks());
                }}
              >
                O‘chirish
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
