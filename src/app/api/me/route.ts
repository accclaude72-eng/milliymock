import { z } from "zod";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { COL, createProfile, getProfile, rateLimit } from "@/lib/server/repo";
import { requireUser } from "@/lib/server/user-auth";

const name = z.string().trim().min(2, "kamida 2 ta belgi").max(60);
const optional = (max: number) => z.string().trim().max(max).optional().default("");

const ProfileInput = z.object({
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^\+?[0-9 ()-]{7,20}$/, "telefon raqami noto‘g‘ri")
    .optional()
    .default(""),
  region: optional(60),
  institution: optional(120),
  grade: optional(40),
});

/** Current user's profile (null when not yet provisioned). */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const profile = await getProfile(user.uid);
  if (profile) {
    const patch: Record<string, unknown> = { lastSeenAt: Date.now() };
    if (profile.emailVerified !== user.emailVerified) patch.emailVerified = user.emailVerified;
    await db().collection(COL.profiles).doc(user.uid).update(patch);
  }
  return ok({ profile: profile ? { ...profile, emailVerified: user.emailVerified } : null, email: user.email, emailVerified: user.emailVerified });
});

/** Provisions the profile + Candidate ID (idempotent). */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  if (!(await rateLimit(`profile:${user.uid}`, 10, 10 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. 10 daqiqadan so‘ng qayta urinib ko‘ring.");
  const input = ProfileInput.parse(await readJson(req));
  const profile = await createProfile(user.uid, user.email, input, user.emailVerified);
  return ok({ profile }, 201);
});

/** Updates editable profile fields. Candidate ID and status are never client-editable. */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const input = ProfileInput.parse(await readJson(req));
  const existing = await getProfile(user.uid);
  if (!existing) throw new ApiError(404, "profile_required", "Profil topilmadi.");
  await db()
    .collection(COL.profiles)
    .doc(user.uid)
    .update({ ...input, updatedAt: Date.now() });
  return ok({ profile: { ...existing, ...input } });
});
