"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";
import type { SubjectWithFormat } from "@/lib/types";

interface Deck {
  id: string;
  title: string;
  description: string | null;
  subjectCode: string | null;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  cards: number;
}
interface Detail {
  deck: { id: string; title: string; status: string };
  cards: { id: string; front: string; back: string }[];
}
const STATUS = { draft: "qoralama", published: "e’lon qilingan", archived: "arxiv" } as const;

export default function DecksAdmin() {
  const [data, setData] = useState<{ decks: Deck[]; studentDecks: number } | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithFormat[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", subjectCode: "", description: "" });
  const [open, setOpen] = useState<Detail | null>(null);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi<{ decks: Deck[]; studentDecks: number }>("/api/admin/flashcards")
      .then(setData)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(() => {
    load();
    adminApi<SubjectWithFormat[]>("/api/subjects")
      .then(setSubjects)
      .catch(() => undefined);
  }, [load]);

  const openDeck = (id: string) =>
    adminApi<Detail>(`/api/admin/flashcards/${id}`)
      .then(setOpen)
      .catch((e) => setErr(errorText(e)));

  const act = async (id: string, body: Record<string, unknown>, ok?: string) => {
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      const r = await adminApi<{ added?: number }>(`/api/admin/flashcards/${id}`, { method: "POST", body });
      setNote(r.added ? `${r.added} ta karta qo‘shildi.` : (ok ?? "Saqlandi."));
      load();
      if (open?.deck.id === id) await openDeck(id);
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!data && !err) return <PageLoader />;
  return (
    <div>
      <p className="eyebrow">12 · Kontent</p>
      <h1 className="display mt-1 text-4xl">Flashcard to‘plamlari</h1>
      <p className="mt-1 text-sm text-muted">Rasmiy to‘plamlar e’lon qilinganda barcha nomzodlarga ko‘rinadi. Nomzodlar o‘zlari yaratgan to‘plamlar: {data?.studentDecks ?? 0} ta.</p>
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
        className="sheet-hard mt-6 grid gap-3 p-5 md:grid-cols-[1fr_200px_auto] md:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const r = await adminApi<{ id: string }>("/api/admin/flashcards", {
              method: "POST",
              body: { title: f.title.trim(), subjectCode: f.subjectCode || null, description: f.description.trim() || null },
            });
            setF({ title: "", subjectCode: "", description: "" });
            load();
            openDeck(r.id);
          } catch (e2) {
            setErr(errorText(e2));
          }
        }}
      >
        <div>
          <label className="label" htmlFor="ad-title">
            Yangi to‘plam nomi
          </label>
          <input id="ad-title" className="field" required minLength={3} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ad-subj">
            Fan
          </label>
          <select id="ad-subj" className="field" value={f.subjectCode} onChange={(e) => setF({ ...f, subjectCode: e.target.value })}>
            <option value="">Umumiy</option>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary">Yaratish</button>
      </form>

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2">Nomi</th>
            <th>Kartalar</th>
            <th>Holati</th>
            <th>Yangilangan</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-hair border-y border-hair">
          {data?.decks.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-muted">
                Hali rasmiy to‘plam yo‘q.
              </td>
            </tr>
          )}
          {data?.decks.map((d) => (
            <tr key={d.id} className={cx(open?.deck.id === d.id && "bg-paper-2")}>
              <td className="py-2 font-medium">
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => openDeck(d.id)}>
                  {d.title}
                </button>
              </td>
              <td className="num">{d.cards}</td>
              <td>
                <span className={cx("chip", d.status === "published" ? "chip-ok" : d.status === "draft" ? "chip-warn" : "")}>{STATUS[d.status]}</span>
              </td>
              <td className="num text-muted">{fmtDateTime(Date.parse(d.updatedAt))}</td>
              <td className="space-x-1 text-right">
                {d.status !== "published" && (
                  <button type="button" className="btn btn-sm btn-primary" disabled={!d.cards} onClick={() => act(d.id, { action: "status", status: "published" }, "E’lon qilindi.")}>
                    E’lon qilish
                  </button>
                )}
                {d.status === "published" && (
                  <button type="button" className="btn btn-sm" onClick={() => act(d.id, { action: "status", status: "archived" }, "Arxivlandi.")}>
                    Arxivlash
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <section className="sheet-hard mt-6 p-5">
          <h2 className="text-xl font-semibold">{open.deck.title}</h2>
          <form
            className="mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(open.deck.id, { action: "add", text: bulk })) setBulk("");
            }}
          >
            <label className="label" htmlFor="ad-bulk">
              Kartalar — har qatorda: savol | javob
            </label>
            <textarea
              id="ad-bulk"
              className="field font-mono text-sm"
              rows={6}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Mitoxondriya | ATF sintezlanadigan organoid\nRibosoma | oqsil sintezi"}
            />
            <button className="btn btn-primary mt-2" disabled={busy || !bulk.includes("|")}>
              {busy && <Spinner />} Qo‘shish
            </button>
          </form>
          <ul className="mt-4 divide-y divide-hair border-y border-hair">
            {open.cards.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 whitespace-pre-wrap font-medium">{c.front}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap text-muted">{c.back}</span>
                <button type="button" className="text-xs text-accent" onClick={() => act(open.deck.id, { action: "delete_card", cardId: c.id }, "Karta o‘chirildi.")}>
                  o‘chirish
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
