import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { adminAuth, db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit, getProfile } from "@/lib/server/repo";
import type { Attempt } from "@/lib/types";

type Ctx = { params: Promise<{ uid: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const { uid } = await params;
  const profile = await getProfile(uid);
  if (!profile) throw new ApiError(404, "not_found", "Foydalanuvchi topilmadi.");
  const snap = await db().collection(COL.attempts).where("uid", "==", uid).get();
  const attempts = snap.docs
    .map((d) => d.data() as Attempt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((a) => ({
      id: a.id,
      materialTitle: a.materialTitle,
      subjectName: a.subjectName,
      status: a.status,
      createdAt: a.createdAt,
      percent: a.grading?.summary.percent ?? null,
    }));
  return ok({ profile, attempts });
});

const Body = z.object({ action: z.enum(["suspend", "activate"]) });

export const PATCH = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { uid } = await params;
  const { action } = Body.parse(await readJson(req));
  const profile = await getProfile(uid);
  if (!profile) throw new ApiError(404, "not_found", "Foydalanuvchi topilmadi.");
  const status = action === "suspend" ? "suspended" : "active";
  await db().collection(COL.profiles).doc(uid).update({ status, updatedAt: Date.now() });
  try {
    await adminAuth().updateUser(uid, { disabled: action === "suspend" });
    if (action === "suspend") await adminAuth().revokeRefreshTokens(uid);
  } catch (e) {
    console.error("[admin] auth update failed", e);
  }
  await audit(`user.${action}`, `profiles/${uid}`, { before: profile.status, after: status, candidateId: profile.candidateId });
  return ok({ status });
});
