import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { VideoInput } from "@/lib/server/videos";
import { parseVideoUrl } from "@/lib/sm2";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.union([z.object({ action: z.literal("status"), status: z.enum(["draft", "published", "archived"]) }), VideoInput.extend({ action: z.literal("update") })]);

/** Edit a lesson or change its status (archive instead of delete: progress is kept). */
export const POST = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Video topilmadi.");
  const b = Body.parse(await readJson(req));
  let patch: Record<string, unknown>;
  if (b.action === "status") patch = { status: b.status };
  else {
    const v = parseVideoUrl(b.url);
    if (!v) throw new ApiError(400, "bad_url", "Faqat YouTube yoki Vimeo havolasini kiriting.");
    patch = {
      subject_code: b.subjectCode,
      topic: b.topic || null,
      title: b.title,
      description: b.description || null,
      provider: v.provider,
      video_ref: v.ref,
      duration_sec: b.durationMin ? Math.round(b.durationMin * 60) : null,
      position: b.position,
    };
  }
  const r = must(
    await sb()
      .from("video_lessons")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle(),
    "update video",
  );
  if (!r) throw new ApiError(404, "not_found", "Video topilmadi.");
  await audit(b.action === "status" ? `video.${b.status}` : "video.update", `videos/${id}`, {});
  return ok({ id });
});
