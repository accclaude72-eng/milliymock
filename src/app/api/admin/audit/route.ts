import { requireAdmin } from "@/lib/server/admin-session";
import { ok, route } from "@/lib/server/http";
import { T, must, sb } from "@/lib/server/supabase";

export const GET = route(async () => {
  await requireAdmin();
  const rows = must(await sb().from(T.audit).select("*").order("at", { ascending: false }).limit(300), "audit");
  return ok((rows ?? []).map((a) => ({ ...a, id: String(a.id), at: Date.parse(a.at) })));
});
