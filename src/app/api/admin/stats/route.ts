import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";
import { COL, listSubjects } from "@/lib/server/repo";

export const GET = route(async () => {
  await requireAdmin();
  const f = db();
  const now = Date.now();
  const week = now - 7 * 86_400_000;
  const day = now - 86_400_000;
  const [users, newUsers, activeUsers, attempts, pending, published, drafts, recentUsers, recentAudit, subjects] = await Promise.all([
    f.collection(COL.profiles).count().get(),
    f.collection(COL.profiles).where("createdAt", ">=", week).count().get(),
    f.collection(COL.profiles).where("lastSeenAt", ">=", day).count().get(),
    f.collection(COL.attempts).select("subjectCode", "status").get(),
    f.collection(COL.attempts).where("status", "==", "pending_review").count().get(),
    f.collection(COL.materials).where("status", "==", "published").count().get(),
    f.collection(COL.materials).where("status", "==", "draft").count().get(),
    f.collection(COL.profiles).orderBy("createdAt", "desc").limit(8).get(),
    f.collection(COL.audit).orderBy("at", "desc").limit(10).get(),
    listSubjects(true),
  ]);
  const bySubject: Record<string, { total: number; finished: number }> = {};
  for (const d of attempts.docs) {
    const s = (d.get("subjectCode") as string) ?? "?";
    const b = (bySubject[s] ??= { total: 0, finished: 0 });
    b.total++;
    if (d.get("status") !== "in_progress") b.finished++;
  }
  return ok({
    users: users.data().count,
    newUsers7d: newUsers.data().count,
    activeUsers24h: activeUsers.data().count,
    attempts: attempts.size,
    pendingReview: pending.data().count,
    publishedMaterials: published.data().count,
    draftMaterials: drafts.data().count,
    bySubject: subjects.map((s) => ({ code: s.code, name: s.name, ...(bySubject[s.code] ?? { total: 0, finished: 0 }) })),
    recentUsers: recentUsers.docs.map((d) => {
      const p = d.data();
      return { uid: p.uid, name: `${p.firstName} ${p.lastName}`, email: p.email, candidateId: p.candidateId, createdAt: p.createdAt, region: p.region ?? "" };
    }),
    recentAudit: recentAudit.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
});
