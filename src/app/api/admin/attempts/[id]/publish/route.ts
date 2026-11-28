import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { updateAttempt } from "@/lib/server/attempts";
import { revokeForAttempt } from "@/lib/server/certificates";
import { notifyResultPublished } from "@/lib/server/notifications";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";

const Body = z.object({ action: z.enum(["publish", "unpublish"]) });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const { action } = Body.parse(await readJson(req));
  const a = await updateAttempt(id, (a) => {
    const now = Date.now();
    if (action === "publish") {
      if (a.status === "published") return null;
      if (a.status !== "graded") throw new ApiError(409, "not_graded", "E’lon qilishdan oldin barcha yozma ishlar va shubhali javoblar tekshirilishi kerak.");
      return { status: "published", publishedAt: now, statusHistory: [...a.statusHistory, { status: "published", at: now }] };
    }
    if (a.status !== "published") return null;
    // Re-open for recheck. Auto-published attempts (no human review needed) go back to graded too.
    return { status: "graded", publishedAt: null, statusHistory: [...a.statusHistory, { status: "graded", at: now }] };
  });
  await audit(`result.${action}`, `attempts/${id}`, { status: a.status });
  if (action === "publish" && a.status === "published") await notifyResultPublished(a);
  // A result taken back for recheck can no longer back a certificate.
  if (action === "unpublish") await revokeForAttempt(id, "Natija qayta tekshiruvga olindi");
  return ok({ status: a.status });
});
