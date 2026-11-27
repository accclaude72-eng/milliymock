import { requireAdmin } from "@/lib/server/admin-session";
import { ok, route } from "@/lib/server/http";
import { listSubjects } from "@/lib/server/repo";
import { T, must, sb } from "@/lib/server/supabase";
import type { Profile } from "@/lib/types";

const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const r = await q;
  must({ data: null, error: r.error }, "count");
  return r.count ?? 0;
};

export const GET = route(async () => {
  await requireAdmin();
  const now = Date.now();
  const head = { count: "exact" as const, head: true };
  const [users, newUsers, activeUsers, attempts, pending, published, drafts, recentUsers, recentAudit, subjects] = await Promise.all([
    count(sb().from(T.profiles).select("id", head)),
    count(sb().from(T.profiles).select("id", head).gte("created_ms", now - 7 * 86_400_000)),
    count(sb().from(T.profiles).select("id", head).gte("last_seen_ms", now - 86_400_000)),
    sb().from(T.attempts).select("subject_code, status"),
    count(sb().from(T.attempts).select("id", head).eq("status", "pending_review")),
    count(sb().from(T.materials).select("id", head).eq("status", "published")),
    count(sb().from(T.materials).select("id", head).eq("status", "draft")),
    sb().from(T.profiles).select("doc").order("created_ms", { ascending: false }).limit(8),
    sb().from(T.audit).select("*").order("at", { ascending: false }).limit(10),
    listSubjects(true),
  ]);
  const rows = must(attempts, "attempts") ?? [];
  const bySubject: Record<string, { total: number; finished: number }> = {};
  for (const r of rows) {
    const b = (bySubject[r.subject_code] ??= { total: 0, finished: 0 });
    b.total++;
    if (r.status !== "in_progress") b.finished++;
  }
  return ok({
    users,
    newUsers7d: newUsers,
    activeUsers24h: activeUsers,
    attempts: rows.length,
    pendingReview: pending,
    publishedMaterials: published,
    draftMaterials: drafts,
    bySubject: subjects.map((s) => ({ code: s.code, name: s.name, ...(bySubject[s.code] ?? { total: 0, finished: 0 }) })),
    recentUsers: (must(recentUsers, "recent users") ?? []).map(({ doc }) => {
      const p = doc as Profile;
      return { uid: p.uid, name: `${p.firstName} ${p.lastName}`, email: p.email, candidateId: p.candidateId, createdAt: p.createdAt, region: p.region ?? "" };
    }),
    recentAudit: (must(recentAudit, "audit") ?? []).map((a) => ({ ...a, id: String(a.id), at: Date.parse(a.at) })),
  });
});
