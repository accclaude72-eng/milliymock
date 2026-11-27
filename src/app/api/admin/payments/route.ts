import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { decidePayment, listPayments } from "@/lib/server/payments";
import { notifyTelegram, plain } from "@/lib/server/telegram";

export const GET = route(async () => {
  await requireAdmin();
  return ok(await listPayments());
});

const Decide = z.object({
  uid: z.string().regex(/^[0-9a-f-]{36}$/i),
  materialId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  decision: z.enum(["approved", "rejected"]),
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Decide.parse(await readJson(req));
  const r = await decidePayment(b.uid, b.materialId, b.decision, "admin");
  await notifyTelegram(`${b.decision === "approved" ? "✅ To‘lov tasdiqlandi" : "❌ To‘lov rad etildi"}: ${plain(r.candidateName)} — ${plain(r.materialTitle)} (${r.amount.toLocaleString("ru-RU")} so‘m)`);
  return ok(r);
});
