import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, ok, route } from "@/lib/server/http";
import { getMaterial } from "@/lib/server/repo";
import { readUrl } from "@/lib/server/storage";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const m = await getMaterial(id);
  if (!m.html) throw new ApiError(404, "no_booklet", "HTML fayl yuklanmagan.");
  return ok({ url: await readUrl(m.html.path, 60) });
});
