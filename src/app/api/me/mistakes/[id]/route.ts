import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z
  .object({
    bookmarked: z.boolean().optional(),
    note: z.string().max(2000).optional(),
    status: z.enum(["open", "understood"]).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "hech narsa o‘zgarmadi");

/** Bookmark / personal note / "I understood this" — only on the student's own rows. */
export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, "not_found", "Topilmadi.");
  const body = Body.parse(await readJson(req));
  const cur = must(await sb().from("student_mistakes").select("id, status").eq("id", id).eq("user_id", user.uid).maybeSingle(), "mistake");
  if (!cur) throw new ApiError(404, "not_found", "Topilmadi.");
  if (body.status && cur.status === "resolved") throw new ApiError(409, "resolved", "Bu xato allaqachon hal qilingan.");
  const patch: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
  if (body.note !== undefined) patch.note = body.note.trim() || null;
  must(await sb().from("student_mistakes").update(patch).eq("id", id).eq("user_id", user.uid), "mistake update");
  return ok({ id, ...body });
});
