import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";
import { COL } from "@/lib/server/repo";

export const GET = route(async () => {
  await requireAdmin();
  const snap = await db().collection(COL.audit).orderBy("at", "desc").limit(300).get();
  return ok(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});
