import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";
import { readUrl } from "@/lib/server/storage";
import type { Attempt } from "@/lib/types";

export const GET = route<{ params: Promise<{ id: string; fileId: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const { id, fileId } = await params;
  const snap = await db().collection(COL.attempts).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "not_found", "Urinish topilmadi.");
  const a = snap.data() as Attempt;
  const file = Object.values(a.o2Files ?? {})
    .flat()
    .find((x) => x.id === fileId);
  if (!file) throw new ApiError(404, "not_found", "Fayl topilmadi.");
  return ok({ url: await readUrl(file.path, 30), name: file.name, contentType: file.contentType });
});
