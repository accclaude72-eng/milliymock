import "server-only";
import type { Profile } from "../types";
import { adminAuth } from "./firebase-admin";
import { ApiError } from "./http";
import { getProfile } from "./repo";

export interface AuthedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

/** Verifies the Firebase ID token in `Authorization: Bearer <token>`. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) throw new ApiError(401, "unauthenticated", "Avval tizimga kiring.");
  try {
    const t = await adminAuth().verifyIdToken(h.slice(7), true);
    if (t.firebase?.sign_in_provider === "custom") throw new Error("custom tokens are not candidates");
    return { uid: t.uid, email: t.email ?? "", emailVerified: !!t.email_verified };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/user-disabled") throw new ApiError(403, "suspended", "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.");
    throw new ApiError(401, "unauthenticated", "Sessiya muddati tugagan. Qayta kiring.");
  }
}

/** Like requireUser, but also requires a provisioned, active profile. */
export async function requireCandidate(req: Request): Promise<{ user: AuthedUser; profile: Profile }> {
  const user = await requireUser(req);
  const profile = await getProfile(user.uid);
  if (!profile) throw new ApiError(409, "profile_required", "Profilingizni to‘ldiring.");
  if (profile.status !== "active") throw new ApiError(403, "suspended", "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.");
  return { user, profile };
}
