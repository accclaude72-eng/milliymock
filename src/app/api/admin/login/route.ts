import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_COOKIE, createAdminToken, verifyAdminCode } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/server/http";
import { audit, rateLimit, resetRateLimit } from "@/lib/server/repo";

const Body = z.object({ code: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const ipHash = createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24);
  const ipKey = `admin-login:${ipHash}`;
  const [ipOk, globalOk] = await Promise.all([rateLimit(ipKey, 5, 15 * 60_000), rateLimit("admin-login:global", 100, 60 * 60_000)]);
  if (!ipOk || !globalOk) throw new ApiError(429, "rate_limited", "Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring.");

  const { code } = Body.parse(await readJson(req));
  // Constant-ish response time regardless of outcome.
  const started = Date.now();
  const valid = verifyAdminCode(code);
  const wait = 400 - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  if (!valid) {
    await audit("admin.login_failed", "admin", { ip: ipHash }, "anonymous");
    throw new ApiError(401, "invalid_code", "Kod noto‘g‘ri.");
  }
  await resetRateLimit(ipKey);
  const { token, maxAge } = createAdminToken();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  await audit("admin.login", "admin", { ip: ipHash });
  return ok({ loggedIn: true });
});
