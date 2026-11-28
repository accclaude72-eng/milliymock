import { requireAdmin } from "@/lib/server/admin-session";
import { assertSameOrigin, ok, route } from "@/lib/server/http";
import { syncAll } from "@/lib/server/question-bank";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

export const maxDuration = 120;

/** Bank size per subject (active = usable for free practice). */
export const GET = route(async () => {
  await requireAdmin();
  const rows = must(await sb().from("question_bank").select("subject_code, active").limit(20000), "bank stats") ?? [];
  const bySubject: Record<string, { total: number; active: number }> = {};
  for (const r of rows) {
    const s = (bySubject[r.subject_code] ??= { total: 0, active: 0 });
    s.total++;
    if (r.active) s.active++;
  }
  return ok({ total: rows.length, bySubject });
});

/** Rebuilds the bank from every published booklet + key. Keeps admin-written explanations. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const r = await syncAll();
  await audit("question_bank.sync", "question_bank", r);
  return ok(r);
});
