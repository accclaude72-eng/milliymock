import "server-only";
import type { Profile } from "../types";
import { ApiError } from "./http";
import { getProfile } from "./repo";
import { sb } from "./supabase";

export interface AuthedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

/** Verifies the Supabase access token in `Authorization: Bearer <token>` against Supabase Auth. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) throw new ApiError(401, "unauthenticated", "Avval tizimga kiring.");
  const { data, error } = await sb().auth.getUser(h.slice(7));
  if (error || !data.user) {
    if (error?.code === "user_banned") throw new ApiError(403, "suspended", "Hisobingiz vaqtincha bloklangan. Administrator bilan bogʻlaning.");
    throw new ApiError(401, "unauthenticated", "Sessiya muddati tugagan. Qayta kiring.");
  }
  const u = data.user;
  return { uid: u.id, email: u.email ?? "", emailVerified: !!u.email_confirmed_at };
}

/** Like requireUser, but also requires a provisioned, active profile. */
export async function requireCandidate(req: Request): Promise<{ user: AuthedUser; profile: Profile }> {
  const user = await requireUser(req);
  const profile = await getProfile(user.uid);
  if (!profile) throw new ApiError(409, "profile_required", "Profilingizni toʻldiring.");
  if (profile.status !== "active") throw new ApiError(403, "suspended", "Hisobingiz vaqtincha bloklangan. Administrator bilan bogʻlaning.");
  return { user, profile };
}
