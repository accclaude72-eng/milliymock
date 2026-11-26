import { db } from "@/lib/server/firebase-admin";
import { ApiError, ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";
import { readUrl } from "@/lib/server/storage";
import { requireCandidate } from "@/lib/server/user-auth";
import type { Attempt } from "@/lib/types";

/** Returns a short-lived URL to the candidate's own uploaded O2 file. */
export const GET = route<{ params: Promise<{ id: string; fileId: string }> }>(async (req, { params }) => {
  const { id, fileId } = await params;
  const { user } = await requireCandidate(req);
  const snap = await db().collection(COL.attempts).doc(id).get();
  const a = snap.data() as Attempt | undefined;
  if (!a || a.uid !== user.uid) throw new ApiError(404, "not_found", "Fayl topilmadi.");
  const file = Object.values(a.o2Files ?? {})
    .flat()
    .find((f) => f.id === fileId);
  if (!file) throw new ApiError(404, "not_found", "Fayl topilmadi.");
  return ok({ url: await readUrl(file.path, 15), name: file.name, contentType: file.contentType });
});
