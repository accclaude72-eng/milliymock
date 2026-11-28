import { ok, route } from "@/lib/server/http";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Published video lessons with the student's progress. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const [vids, prog] = await Promise.all([
    sb()
      .from("video_lessons")
      .select("id, subject_code, topic, title, description, provider, video_ref, duration_sec, position")
      .eq("status", "published")
      .order("subject_code")
      .order("position")
      .limit(1000),
    sb().from("video_progress").select("video_id, watched_sec, completed").eq("user_id", user.uid),
  ]);
  const p = new Map(((must(prog, "video progress") ?? []) as { video_id: string; watched_sec: number; completed: boolean }[]).map((r) => [r.video_id, r]));
  return ok({
    videos: (
      (must(vids, "videos") ?? []) as {
        id: string;
        subject_code: string;
        topic: string | null;
        title: string;
        description: string | null;
        provider: string;
        video_ref: string;
        duration_sec: number | null;
      }[]
    ).map((v) => ({
      id: v.id,
      subjectCode: v.subject_code,
      topic: v.topic,
      title: v.title,
      description: v.description,
      provider: v.provider,
      ref: v.video_ref,
      durationSec: v.duration_sec,
      completed: p.get(v.id)?.completed ?? false,
    })),
  });
});
