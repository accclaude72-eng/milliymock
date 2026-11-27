import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { paymentOf, requestPayment } from "@/lib/server/payments";
import { getMaterial, rateLimit } from "@/lib/server/repo";
import { notifyTelegram, plain } from "@/lib/server/telegram";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({ note: z.string().trim().min(3, "kamida 3 ta belgi").max(300) });

/** Candidate says "I have paid" → the admin checks the card and approves. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  const { id } = await params;
  const { profile } = await requireCandidate(req);
  if (!(await rateLimit(`payreq:${profile.uid}`, 10, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.");
  const { note } = Body.parse(await readJson(req));
  const m = await getMaterial(id).catch(() => null);
  if (!m || m.status !== "published") throw new ApiError(404, "material_not_found", "Test topilmadi.");
  if (!m.price || m.price <= 0) throw new ApiError(400, "free", "Bu test bepul.");
  const cur = await paymentOf(profile.uid, id);
  if (cur?.status === "approved") throw new ApiError(409, "already_paid", "To‘lovingiz allaqachon tasdiqlangan.");
  if (cur?.status === "pending") throw new ApiError(409, "pending", "So‘rovingiz tekshirilmoqda.");
  const candidateName = `${profile.firstName} ${profile.lastName}`;
  await requestPayment({ uid: profile.uid, materialId: id, candidateId: profile.candidateId, candidateName, amount: m.price, materialTitle: m.title, note });
  await notifyTelegram(
    `💳 <b>Yangi to‘lov so‘rovi</b>\n${plain(candidateName)} (${profile.candidateId})\nTest: ${plain(m.title)}\nSumma: ${m.price.toLocaleString("ru-RU")} so‘m\nIzoh: ${plain(note)}\n\nAdmin panel → To‘lovlar bo‘limida tasdiqlang.`,
  );
  return ok({ status: "pending" }, 201);
});
