import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { addCards, deckCards } from "@/lib/server/flashcards";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { parseCardLines } from "@/lib/sm2";

type Ctx = { params: Promise<{ id: string }> };

async function official(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "To‘plam topilmadi.");
  const d = must(await sb().from("flashcard_decks").select("*").eq("id", id).is("owner_id", null).maybeSingle(), "official deck");
  if (!d) throw new ApiError(404, "not_found", "To‘plam topilmadi.");
  return d as { id: string; title: string; description: string | null; subject_code: string | null; status: string };
}

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const d = await official((await params).id);
  const cards = await deckCards(d.id);
  return ok({ deck: { id: d.id, title: d.title, description: d.description, subjectCode: d.subject_code, status: d.status }, cards: cards.map((c) => ({ id: c.id, front: c.front, back: c.back })) });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), text: z.string().min(1).max(200_000) }),
  z.object({ action: z.literal("delete_card"), cardId: z.string().uuid() }),
  z.object({
    action: z.literal("update"),
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(300).nullable(),
    subjectCode: z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .nullable(),
  }),
  z.object({ action: z.literal("status"), status: z.enum(["draft", "published", "archived"]) }),
]);

export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const d = await official((await params).id);
  const b = Body.parse(await readJson(req));
  if (b.action === "add") {
    const list = parseCardLines(b.text);
    if (!list.length) throw new ApiError(400, "empty", "Kartalar topilmadi. Har qatorda “savol | javob” yozing.");
    const n = await addCards(d.id, list);
    await audit("flashcards.cards_add", `decks/${d.id}`, { count: n });
    return ok({ added: n });
  }
  if (b.action === "delete_card") {
    must(await sb().from("flashcards").delete().eq("id", b.cardId).eq("deck_id", d.id), "admin delete card");
    return ok({ deleted: true });
  }
  if (b.action === "update") {
    must(
      await sb()
        .from("flashcard_decks")
        .update({ title: b.title, description: b.description || null, subject_code: b.subjectCode, updated_at: new Date().toISOString() })
        .eq("id", d.id),
      "update deck",
    );
    return ok({ updated: true });
  }
  must(await sb().from("flashcard_decks").update({ status: b.status, updated_at: new Date().toISOString() }).eq("id", d.id), "deck status");
  await audit(`flashcards.deck_${b.status}`, `decks/${d.id}`, {});
  return ok({ status: b.status });
});
