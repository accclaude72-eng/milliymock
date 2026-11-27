import { playerView, withAttempt } from "@/lib/server/attempts";
import { ok, route } from "@/lib/server/http";
import { readUrl } from "@/lib/server/storage";
import { BUCKET } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Loads (and reconciles) the attempt for the exam player. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const a = await withAttempt(id, user.uid, () => ({}));
  if (a.status !== "in_progress") return ok({ view: playerView(a), bookletUrl: null });
  const bookletUrl = await readUrl(BUCKET.booklets, a.bookletPath, 6 * 60);
  return ok({ view: playerView(a), bookletUrl });
});
