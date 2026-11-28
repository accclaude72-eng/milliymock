import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

export const GET = route(async (req) => {
  await requireAdmin();
  const q = (new URL(req.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 60)
    .replace(/[%,()*]/g, "");
  let query = sb()
    .from("certificates")
    .select("id, serial, candidate_name, candidate_id, material_title, percent, issued_at, status, revoked_reason")
    .order("issued_at", { ascending: false })
    .limit(200);
  if (q) query = query.or(`serial.ilike.%${q}%,candidate_name.ilike.%${q}%,candidate_id.ilike.%${q}%`);
  const [certs, checks] = await Promise.all([
    query,
    sb()
      .from("certificate_checks")
      .select("found")
      .gte("checked_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(5000),
  ]);
  const ch = (must(checks, "checks") ?? []) as { found: boolean }[];
  return ok({ certificates: must(certs, "admin certs") ?? [], checks30d: ch.length, failedChecks30d: ch.filter((c) => !c.found).length });
});

const Body = z.object({ action: z.enum(["revoke", "restore"]), id: z.string().uuid(), reason: z.string().trim().max(300).optional() });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Body.parse(await readJson(req));
  if (b.action === "revoke" && !b.reason) throw new ApiError(400, "reason", "Bekor qilish sababini yozing.");
  const patch = b.action === "revoke" ? { status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: b.reason } : { status: "valid", revoked_at: null, revoked_reason: null };
  const r = must(await sb().from("certificates").update(patch).eq("id", b.id).select("serial").maybeSingle(), "cert status");
  if (!r) throw new ApiError(404, "not_found", "Sertifikat topilmadi.");
  await audit(`certificate.${b.action === "revoke" ? "revoked" : "restored"}`, `certificates/${b.id}`, { serial: r.serial, reason: b.reason ?? null });
  return ok({ done: true });
});
