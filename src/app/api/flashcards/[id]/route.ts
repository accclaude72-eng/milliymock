import { z } from "zod";
import { addCards, deckCards, ownDeck, studyQueue, visibleDeck } from "@/lib/server/flashcards";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";
import { parseCardLines } from "@/lib/sm2";

type Ctx = { params: Promise<{ id: string }> };

/** Deck + today's study queue; the full card list for the owner (to edit). */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  const d = await visibleDeck(user.uid, (await params).id);
  const own = d.owner_id === user.uid;
  const [queue, cards] = await Promise.all([studyQueue(user.uid, d), own && d.source !== "mistakes" ? deckCards(d.id) : Promise.resolve([])]);
  return ok({
    deck: { id: d.id, title: d.title, description: d.description, subjectCode: d.subject_code, source: d.source, own, editable: own && d.source !== "mistakes" },
    queue,
    cards: cards.map((c) => ({ id: c.id, front: c.front, back: c.back })),
  });
});

const card = z.object({ front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(2000) });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), cards: z.array(card).min(1).max(200).optional(), text: z.string().max(100_000).optional() }),
  z.object({ action: z.literal("delete_card"), cardId: z.string().uuid() }),
  z.object({ action: z.literal("rename"), title: z.string().trim().min(3).max(80), description: z.string().trim().max(300).nullable() }),
  z.object({ action: z.literal("delete_deck") }),
]);

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const d = await ownDeck(user.uid, (await params).id);
  if (!(await rateLimit(`deckedit:${user.uid}`, 200, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p o‘zgartirish. Birozdan so‘ng urinib ko‘ring.");
  const b = Body.parse(await readJson(req));
  if (b.action === "add") {
    const list = b.cards ?? parseCardLines(b.text ?? "");
    if (!list.length) throw new ApiError(400, "empty", "Kartalar topilmadi. Har qatorda “savol | javob” ko‘rinishida yozing.");
    return ok({ added: await addCards(d.id, list.slice(0, 200)) });
  }
  if (b.action === "delete_card") {
    must(await sb().from("flashcards").delete().eq("id", b.cardId).eq("deck_id", d.id), "delete card");
    return ok({ deleted: true });
  }
  if (b.action === "rename") {
    must(
      await sb()
        .from("flashcard_decks")
        .update({ title: b.title, description: b.description || null, updated_at: new Date().toISOString() })
        .eq("id", d.id),
      "rename deck",
    );
    return ok({ renamed: true });
  }
  must(await sb().from("flashcard_decks").delete().eq("id", d.id).eq("owner_id", user.uid), "delete deck");
  return ok({ deleted: true });
});
