import "server-only";
import { type CardState, NEW_CARD, NEW_PER_DAY, addDays, review } from "@/lib/sm2";
import { ApiError } from "./http";
import { todayUz } from "./plans";
import { bankRows, revealMap } from "./question-bank";
import { must, sb } from "./supabase";

export interface DeckRow {
  id: string;
  owner_id: string | null;
  subject_code: string | null;
  title: string;
  description: string | null;
  source: "admin" | "student" | "mistakes";
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}
export interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  question_id: string | null;
  position: number;
  created_at: string;
}
interface ReviewRow extends CardState {
  user_id: string;
  card_id: string;
  due_on: string;
  last_grade: number | null;
  reviewed_at: string | null;
}

const MAX_OWN_DECKS = 30;
const MAX_CARDS = 500;
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** A deck the student may study: their own, or a published official one. */
export async function visibleDeck(uid: string, id: string): Promise<DeckRow> {
  if (!isId(id)) throw new ApiError(404, "not_found", "To‘plam topilmadi.");
  const d = must(await sb().from("flashcard_decks").select("*").eq("id", id).maybeSingle(), "deck") as DeckRow | null;
  if (!d || (d.owner_id !== uid && !(d.owner_id === null && d.status === "published"))) throw new ApiError(404, "not_found", "To‘plam topilmadi.");
  return d;
}

export async function ownDeck(uid: string, id: string): Promise<DeckRow> {
  const d = await visibleDeck(uid, id);
  if (d.owner_id !== uid) throw new ApiError(403, "forbidden", "Bu to‘plamni faqat ko‘rib chiqish mumkin.");
  if (d.source === "mistakes") throw new ApiError(409, "auto", "“Xatolarim” to‘plami avtomatik yangilanadi.");
  return d;
}

/**
 * "Xatolarim" deck: one card per open mistake from a test whose answers may be shown
 * (front = question with options, back = correct option). Resolved mistakes drop out.
 */
export async function syncMistakesDeck(uid: string): Promise<void> {
  const mistakes = (must(await sb().from("student_mistakes").select("question_id, status").eq("user_id", uid).neq("status", "resolved").limit(MAX_CARDS), "mistakes for deck") ?? []) as {
    question_id: string;
  }[];
  const findDecks = async () => (must(await sb().from("flashcard_decks").select("*").eq("owner_id", uid).eq("source", "mistakes").order("created_at").order("id"), "mistakes deck") ?? []) as DeckRow[];
  let decks = await findDecks();
  if (!decks.length && !mistakes.length) return;
  if (!decks.length) {
    must(
      await sb().from("flashcard_decks").insert({ owner_id: uid, title: "Xatolarim", description: "Xatolar daftaringizdagi ochiq savollardan avtomatik tuziladi.", source: "mistakes" }),
      "create mistakes deck",
    );
    decks = await findDecks();
  }
  // Two first requests at the same moment may both create the deck → keep the oldest, drop the rest.
  const deck = decks[0];
  if (decks.length > 1)
    must(
      await sb()
        .from("flashcard_decks")
        .delete()
        .in(
          "id",
          decks.slice(1).map((d) => d.id),
        ),
      "drop duplicate mistakes decks",
    );
  const cards = (must(await sb().from("flashcards").select("id, question_id").eq("deck_id", deck.id), "mistake cards") ?? []) as { id: string; question_id: string | null }[];
  const want = new Set(mistakes.map((m) => m.question_id));
  const stale = cards.filter((c) => !c.question_id || !want.has(c.question_id)).map((c) => c.id);
  if (stale.length) must(await sb().from("flashcards").delete().in("id", stale), "drop resolved cards");
  const have = new Set(cards.map((c) => c.question_id));
  const missing = [...want].filter((q) => !have.has(q));
  if (!missing.length) return;
  const bank = await bankRows(missing);
  const reveal = await revealMap([...new Set([...bank.values()].map((b) => b.material_id))]);
  const rows = [...bank.values()]
    .filter((q) => reveal.get(q.material_id)?.reveal && q.correct)
    .map((q) => {
      const opts = q.options.length ? `<ul>${q.options.map((o) => `<li><b>${o.letter})</b> ${o.html}</li>`).join("")}</ul>` : "";
      const right = q.options.find((o) => o.letter === q.correct);
      const back = `<p><b>To‘g‘ri javob: ${q.correct}${right ? ")" : ""}</b> ${right?.html ?? ""}</p>${q.explanation ? `<p>${q.explanation}</p>` : ""}`;
      return { deck_id: deck.id, front: `${q.stem_html}${opts}`.slice(0, 2000), back: back.slice(0, 2000), question_id: q.id };
    });
  if (rows.length) {
    // Only missing cards are inserted; a parallel sync may race us → the unique index rejects the duplicate.
    const { error } = await sb().from("flashcards").insert(rows);
    if (error && error.code !== "23505") throw new Error(`mistake cards: ${error.message}`);
  }
}

/** Decks for the student with total / due / new counts. */
export async function listDecks(uid: string) {
  await syncMistakesDeck(uid);
  const decks = (must(await sb().from("flashcard_decks").select("*").or(`owner_id.eq.${uid},and(owner_id.is.null,status.eq.published)`).order("created_at"), "decks") ?? []) as DeckRow[];
  if (!decks.length) return [];
  const ids = decks.map((d) => d.id);
  const [cards, reviews] = await Promise.all([
    sb().from("flashcards").select("id, deck_id").in("deck_id", ids).limit(20000),
    sb().from("flashcard_reviews").select("card_id, due_on").eq("user_id", uid).limit(20000),
  ]);
  const cardRows = (must(cards, "deck cards") ?? []) as { id: string; deck_id: string }[];
  const rev = new Map(((must(reviews, "deck reviews") ?? []) as { card_id: string; due_on: string }[]).map((r) => [r.card_id, r.due_on]));
  const today = todayUz();
  return decks
    .map((d) => {
      const mine = cardRows.filter((c) => c.deck_id === d.id);
      const seen = mine.filter((c) => rev.has(c.id));
      return {
        id: d.id,
        title: d.title,
        description: d.description,
        subjectCode: d.subject_code,
        source: d.source,
        own: d.owner_id === uid,
        total: mine.length,
        due: seen.filter((c) => rev.get(c.id)! <= today).length,
        fresh: mine.length - seen.length,
        learned: seen.length,
      };
    })
    .sort((a, b) => Number(b.source === "mistakes") - Number(a.source === "mistakes") || Number(b.own) - Number(a.own) || a.title.localeCompare(b.title));
}

export async function deckCards(deckId: string): Promise<CardRow[]> {
  return (must(await sb().from("flashcards").select("*").eq("deck_id", deckId).order("position").order("created_at").limit(MAX_CARDS), "cards") ?? []) as CardRow[];
}

/** Today's session: due cards first (oldest due first), then up to NEW_PER_DAY new cards. */
export async function studyQueue(uid: string, deck: DeckRow) {
  const cards = await deckCards(deck.id);
  const ids = cards.map((c) => c.id);
  const reviews = ids.length ? ((must(await sb().from("flashcard_reviews").select("*").eq("user_id", uid).in("card_id", ids), "queue reviews") ?? []) as ReviewRow[]) : [];
  const byCard = new Map(reviews.map((r) => [r.card_id, r]));
  const today = todayUz();
  const due = cards.filter((c) => byCard.get(c.id) && byCard.get(c.id)!.due_on <= today).sort((a, b) => byCard.get(a.id)!.due_on.localeCompare(byCard.get(b.id)!.due_on));
  const fresh = cards.filter((c) => !byCard.has(c.id)).slice(0, NEW_PER_DAY);
  const state = (c: CardRow): CardState => {
    const r = byCard.get(c.id);
    return r ? { ease: Number(r.ease), interval_days: r.interval_days, repetitions: r.repetitions, lapses: r.lapses } : NEW_CARD;
  };
  return [...due, ...fresh].map((c) => ({ id: c.id, front: c.front, back: c.back, html: !!c.question_id, isNew: !byCard.has(c.id), state: state(c) }));
}

/** Records one review with SM-2. */
export async function gradeCard(uid: string, cardId: string, grade: number) {
  if (!isId(cardId)) throw new ApiError(404, "not_found", "Karta topilmadi.");
  const card = must(await sb().from("flashcards").select("id, deck_id").eq("id", cardId).maybeSingle(), "card") as { id: string; deck_id: string } | null;
  if (!card) throw new ApiError(404, "not_found", "Karta topilmadi.");
  await visibleDeck(uid, card.deck_id);
  const prev = must(await sb().from("flashcard_reviews").select("*").eq("user_id", uid).eq("card_id", cardId).maybeSingle(), "card review") as ReviewRow | null;
  const next = review(prev ? { ease: Number(prev.ease), interval_days: prev.interval_days, repetitions: prev.repetitions, lapses: prev.lapses } : NEW_CARD, grade);
  const due_on = addDays(todayUz(), next.interval_days);
  must(
    await sb()
      .from("flashcard_reviews")
      .upsert({ user_id: uid, card_id: cardId, ...next, due_on, last_grade: grade, reviewed_at: new Date().toISOString() }, { onConflict: "user_id,card_id" }),
    "save review",
  );
  return { ...next, dueOn: due_on };
}

export async function createDeck(ownerId: string | null, input: { title: string; description: string | null; subjectCode: string | null; status?: DeckRow["status"] }): Promise<string> {
  if (ownerId) {
    const n = must(await sb().from("flashcard_decks").select("id").eq("owner_id", ownerId), "own decks")?.length ?? 0;
    if (n >= MAX_OWN_DECKS) throw new ApiError(409, "limit", `Ko‘pi bilan ${MAX_OWN_DECKS} ta to‘plam yaratish mumkin.`);
  }
  const d = must(
    await sb()
      .from("flashcard_decks")
      .insert({
        owner_id: ownerId,
        title: input.title,
        description: input.description,
        subject_code: input.subjectCode,
        source: ownerId ? "student" : "admin",
        status: input.status ?? (ownerId ? "published" : "draft"),
      })
      .select("id")
      .single(),
    "create deck",
  ) as { id: string };
  return d.id;
}

export async function addCards(deckId: string, cards: { front: string; back: string }[]): Promise<number> {
  const existing = must(await sb().from("flashcards").select("position").eq("deck_id", deckId).order("position", { ascending: false }).limit(MAX_CARDS), "card count") ?? [];
  if (existing.length + cards.length > MAX_CARDS) throw new ApiError(409, "limit", `Bitta to‘plamda ko‘pi bilan ${MAX_CARDS} ta karta bo‘ladi.`);
  const start = existing.length ? Number(existing[0].position) + 1 : 0;
  must(
    await sb()
      .from("flashcards")
      .insert(cards.map((c, i) => ({ deck_id: deckId, front: c.front, back: c.back, position: start + i }))),
    "add cards",
  );
  await sb().from("flashcard_decks").update({ updated_at: new Date().toISOString() }).eq("id", deckId);
  return cards.length;
}
