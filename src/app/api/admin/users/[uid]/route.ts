import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { attemptsOf, audit, getProfile, saveProfile } from "@/lib/server/repo";
import { sb } from "@/lib/server/supabase";

type Ctx = { params: Promise<{ uid: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const { uid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(uid)) throw new ApiError(404, "not_found", "Foydalanuvchi topilmadi.");
  const profile = await getProfile(uid);
  if (!profile) throw new ApiError(404, "not_found", "Foydalanuvchi topilmadi.");
  const attempts = (await attemptsOf({ uid })).map((a) => ({
    id: a.id,
    materialTitle: a.materialTitle,
    subjectName: a.subjectName,
    status: a.status,
    createdAt: a.createdAt,
    percent: a.grading?.summary.percent ?? null,
  }));
  return ok({ profile, attempts });
});

const Body = z.object({ action: z.enum(["suspend", "activate", "reset_password"]) });

export const PATCH = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { uid } = await params;
  const { action } = Body.parse(await readJson(req));
  const profile = await getProfile(uid);
  if (!profile) throw new ApiError(404, "not_found", "Foydalanuvchi topilmadi.");

  if (action === "reset_password") {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
    const { error } = await sb().auth.resetPasswordForEmail(profile.email, { redirectTo: `${site}/parolni-yangilash` });
    if (error) throw new ApiError(502, "mail_failed", "Xatni yuborib bo‘lmadi. Birozdan so‘ng urinib ko‘ring.");
    await audit("user.reset_password", `profiles/${uid}`, { candidateId: profile.candidateId });
    return ok({ sent: true });
  }

  const status = action === "suspend" ? "suspended" : "active";
  await saveProfile({ ...profile, status, updatedAt: Date.now() });
  // Ban in Supabase Auth too, so existing sessions can no longer be refreshed.
  const { error } = await sb().auth.admin.updateUserById(uid, { ban_duration: action === "suspend" ? "876000h" : "none" });
  if (error) console.error("[admin] auth ban update failed", error);
  await audit(`user.${action}`, `profiles/${uid}`, { before: profile.status, after: status, candidateId: profile.candidateId });
  return ok({ status });
});
