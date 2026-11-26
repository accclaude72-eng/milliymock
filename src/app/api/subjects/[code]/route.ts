import { db } from "@/lib/server/firebase-admin";
import { ApiError, ok, route } from "@/lib/server/http";
import { COL, getFormat, getSubject, toPublicMaterial } from "@/lib/server/repo";
import type { Material, MaterialKeyDoc } from "@/lib/types";

export const GET = route<{ params: Promise<{ code: string }> }>(async (_req, { params }) => {
  const { code } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(code)) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  const subject = await getSubject(code);
  if (subject.archived) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  const [format, mats] = await Promise.all([
    getFormat(subject.activeFormatId).catch(() => null),
    db().collection(COL.materials).where("subjectCode", "==", code).where("status", "==", "published").get(),
  ]);
  const materials = mats.docs
    .map((d) => d.data() as Material)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .map(toPublicMaterial);
  // Number of available questions per topic (counts only — no key content leaves the server).
  const topicCounts: Record<string, number> = {};
  if (materials.length) {
    const keys = await db().getAll(...materials.map((m) => db().collection(COL.materialKeys).doc(m.id)));
    for (const k of keys) {
      const items = (k.data() as MaterialKeyDoc | undefined)?.items ?? {};
      for (const it of Object.values(items)) if (it.topic) topicCounts[it.topic] = (topicCounts[it.topic] ?? 0) + 1;
    }
  }
  return ok({ subject, format, materials, topicCounts });
});
