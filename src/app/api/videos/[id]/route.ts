import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ completed: z.boolean() });

/** Marks a published lesson as watched / not watched. */
export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Video topilmadi.");
  const v = must(await sb().from("video_lessons").select("id, duration_sec").eq("id", id).eq("status", "published").maybeSingle(), "video");
  if (!v) throw new ApiError(404, "not_found", "Video topilmadi.");
  const { completed } = Body.parse(await readJson(req));
  must(
    await sb()
      .from("video_progress")
      .upsert({ user_id: user.uid, video_id: id, completed, watched_sec: completed ? Number(v.duration_sec ?? 0) : 0, updated_at: new Date().toISOString() }, { onConflict: "user_id,video_id" }),
    "video progress",
  );
  return ok({ completed });
});
