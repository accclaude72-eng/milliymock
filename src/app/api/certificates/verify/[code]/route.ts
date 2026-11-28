import { verifyPublic } from "@/lib/server/certificates";
import { ApiError, clientIp, ok, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";

/** Public verification (no login). Limited fields; rate-limited per IP; every check is logged. */
export const GET = route<{ params: Promise<{ code: string }> }>(async (req, { params }) => {
  const ip = clientIp(req);
  if (!(await rateLimit(`certverify:${ip}`, 60, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p tekshiruv. Birozdan so‘ng urinib ko‘ring.");
  const r = await verifyPublic((await params).code, ip);
  if (!r) throw new ApiError(404, "not_found", "Bunday sertifikat topilmadi.");
  return ok(r);
});
