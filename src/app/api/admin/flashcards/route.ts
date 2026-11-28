import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { createDeck } from "@/lib/server/flashcards";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

/** Official decks (owner = null) with card counts, plus how many students made their own. */
export const GET = route(async () => {
  await requireAdmin();
  const [decks, cards, own] = await Promise.all([
    sb().from("flashcard_decks").select("*").is("owner_id", null).order("created_at", { ascending: false }),
    sb().from("flashcards").select("deck_id").limit(50000),
    sb().from("flashcard_decks").select("id", { count: "exact", head: true }).not("owner_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const c of (must(cards, "card counts") ?? []) as { deck_id: string }[]) counts.set(c.deck_id, (counts.get(c.deck_id) ?? 0) + 1);
  return ok({
    decks: ((must(decks, "official decks") ?? []) as { id: string; title: string; description: string | null; subject_code: string | null; status: string; updated_at: string }[]).map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      subjectCode: d.subject_code,
      status: d.status,
      updatedAt: d.updated_at,
      cards: counts.get(d.id) ?? 0,
    })),
    studentDecks: own.count ?? 0,
  });
});

const Body = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(300).nullable().default(null),
  subjectCode: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable()
    .default(null),
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Body.parse(await readJson(req));
  const id = await createDeck(null, { title: b.title, description: b.description || null, subjectCode: b.subjectCode, status: "draft" });
  await audit("flashcards.deck_create", `decks/${id}`, { title: b.title });
  return ok({ id }, 201);
});
