import { requireAdmin } from "@/lib/server/admin-session";
import { attemptTimeSpent, withAttempt } from "@/lib/server/attempts";
import { ok, route } from "@/lib/server/http";
import { getKey } from "@/lib/server/repo";
import { buildSheet } from "@/lib/sheet";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const a = await withAttempt(id, null, () => ({}));
  const key = (await getKey(a.materialId))?.items ?? {};
  const { client: _client, ...rest } = a;
  void _client;
  return ok({
    attempt: {
      ...rest,
      o2Files: Object.fromEntries(
        Object.entries(a.o2Files ?? {}).map(([n, list]) => [n, list.map(({ id: fid, name, size, contentType, uploadedAt }) => ({ id: fid, name, size, contentType, uploadedAt }))]),
      ),
    },
    sheet: buildSheet(a.format, a.structure),
    key,
    timeSpentMs: attemptTimeSpent(a),
  });
});
