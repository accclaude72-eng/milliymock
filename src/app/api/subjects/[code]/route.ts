import { ApiError, ok, route } from "@/lib/server/http";
import { getFormat, getSubject, toPublicMaterial } from "@/lib/server/repo";
import { T, getDocs, must, sb } from "@/lib/server/supabase";
import type { Material, MaterialKeyDoc } from "@/lib/types";

export const GET = route<{ params: Promise<{ code: string }> }>(async (_req, { params }) => {
  const { code } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(code)) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  const subject = await getSubject(code);
  if (subject.archived) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  const [format, rows] = await Promise.all([
    getFormat(subject.activeFormatId).catch(() => null),
    sb().from(T.materials).select("doc").eq("subject_code", code).eq("status", "published").order("published_ms", { ascending: false }),
  ]);
  const materials = (must(rows, "subject materials") ?? []).map((r) => toPublicMaterial(r.doc as Material));
  // Number of available questions per topic (counts only — no key content leaves the server).
  const topicCounts: Record<string, number> = {};
  for (const k of await getDocs<MaterialKeyDoc>(T.keys, materials.map((m) => m.id)))
    for (const it of Object.values(k.items ?? {})) if (it.topic) topicCounts[it.topic] = (topicCounts[it.topic] ?? 0) + 1;
  return ok({ subject, format, materials, topicCounts });
});
