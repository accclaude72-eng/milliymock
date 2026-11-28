import { z } from "zod";
import { eligible, issueCertificate, verifyUrl } from "@/lib/server/certificates";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { attemptsOf, rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

interface CertRow {
  id: string;
  serial: string;
  verify_code: string;
  attempt_id: string;
  material_title: string;
  percent: number;
  level: string;
  issued_at: string;
  status: string;
  revoked_reason: string | null;
}

/** My certificates + published full mocks that can still get one. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const origin = new URL(req.url).origin;
  const [certs, attempts] = await Promise.all([sb().from("certificates").select("*").eq("user_id", user.uid).order("issued_at", { ascending: false }), attemptsOf({ uid: user.uid })]);
  const list = (must(certs, "my certs") ?? []) as CertRow[];
  const have = new Set(list.map((c) => c.attempt_id));
  return ok({
    certificates: list.map((c) => ({
      id: c.id,
      serial: c.serial,
      title: c.material_title,
      percent: Number(c.percent),
      level: c.level,
      issuedAt: Date.parse(c.issued_at),
      status: c.status,
      revokedReason: c.revoked_reason,
      verifyUrl: verifyUrl(c.verify_code, origin),
    })),
    eligible: attempts
      .filter((a) => eligible(a) && !have.has(a.id))
      .map((a) => ({ attemptId: a.id, title: a.materialTitle, percent: Math.round(a.grading!.summary.percent * 10) / 10, publishedAt: a.publishedAt })),
  });
});

const Body = z.object({ attemptId: z.string().regex(/^[a-zA-Z0-9_-]{6,64}$/) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`cert:${user.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
  const { attemptId } = Body.parse(await readJson(req));
  const c = await issueCertificate(user.uid, attemptId);
  return ok({ id: c.id, serial: c.serial }, 201);
});
