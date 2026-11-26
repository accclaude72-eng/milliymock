import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit } from "@/lib/server/repo";
import type { Attempt } from "@/lib/types";

const Body = z.object({ action: z.enum(["publish", "unpublish"]) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const { action } = Body.parse(await readJson(req));
  const f = db();
  const ref = f.collection(COL.attempts).doc(id);
  const status = await f.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "not_found", "Urinish topilmadi.");
    const a = snap.data() as Attempt;
    const now = Date.now();
    if (action === "publish") {
      if (a.status === "published") return a.status;
      if (a.status !== "graded") throw new ApiError(409, "not_graded", "E’lon qilishdan oldin barcha yozma ishlar va shubhali javoblar tekshirilishi kerak.");
      tx.update(ref, { status: "published", publishedAt: now, statusHistory: [...a.statusHistory, { status: "published", at: now }], rev: a.rev + 1 });
      return "published";
    }
    if (a.status !== "published") return a.status;
    // Re-open for recheck. Auto-published attempts (no human review needed) go back to graded too.
    tx.update(ref, { status: "graded", publishedAt: null, statusHistory: [...a.statusHistory, { status: "graded", at: now }], rev: a.rev + 1 });
    return "graded";
  });
  await audit(`result.${action}`, `attempts/${id}`, { status });
  return ok({ status });
});
