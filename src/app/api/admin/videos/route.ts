import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { VideoInput } from "@/lib/server/videos";
import { parseVideoUrl } from "@/lib/sm2";

export const GET = route(async () => {
  await requireAdmin();
  const [vids, prog] = await Promise.all([
    sb().from("video_lessons").select("*").order("subject_code").order("position").limit(1000),
    sb().from("video_progress").select("video_id").eq("completed", true).limit(50000),
  ]);
  const done = new Map<string, number>();
  for (const p of (must(prog, "video done") ?? []) as { video_id: string }[]) done.set(p.video_id, (done.get(p.video_id) ?? 0) + 1);
  return ok({
    videos: ((must(vids, "admin videos") ?? []) as Record<string, unknown>[]).map((v) => ({
      id: v.id,
      subjectCode: v.subject_code,
      topic: v.topic,
      title: v.title,
      description: v.description,
      provider: v.provider,
      ref: v.video_ref,
      durationSec: v.duration_sec,
      position: v.position,
      status: v.status,
      completedBy: done.get(v.id as string) ?? 0,
    })),
  });
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = VideoInput.parse(await readJson(req));
  const v = parseVideoUrl(b.url);
  if (!v) throw new ApiError(400, "bad_url", "Faqat YouTube yoki Vimeo havolasini kiriting.");
  const r = must(
    await sb()
      .from("video_lessons")
      .insert({
        subject_code: b.subjectCode,
        topic: b.topic || null,
        title: b.title,
        description: b.description || null,
        provider: v.provider,
        video_ref: v.ref,
        duration_sec: b.durationMin ? Math.round(b.durationMin * 60) : null,
        position: b.position,
      })
      .select("id")
      .single(),
    "create video",
  ) as { id: string };
  await audit("video.create", `videos/${r.id}`, { title: b.title });
  return ok({ id: r.id }, 201);
});
