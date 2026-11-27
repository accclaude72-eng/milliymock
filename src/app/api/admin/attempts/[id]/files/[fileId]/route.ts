import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, ok, route } from "@/lib/server/http";
import { readUrl } from "@/lib/server/storage";
import { BUCKET, T, getDoc } from "@/lib/server/supabase";
import type { Attempt } from "@/lib/types";

export const GET = route<{ params: Promise<{ id: string; fileId: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const { id, fileId } = await params;
  const a = await getDoc<Attempt>(T.attempts, id);
  if (!a) throw new ApiError(404, "not_found", "Urinish topilmadi.");
  const file = Object.values(a.o2Files ?? {})
    .flat()
    .find((x) => x.id === fileId);
  if (!file) throw new ApiError(404, "not_found", "Fayl topilmadi.");
  return ok({ url: await readUrl(BUCKET.submissions, file.path, 30), name: file.name, contentType: file.contentType });
});
