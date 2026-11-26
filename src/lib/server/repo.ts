import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_FORMATS, DEFAULT_SUBJECTS, type ExamFormat, type SubjectInfo } from "../formats";
import type { Material, Profile, PublicMaterial, SubjectWithFormat } from "../types";
import { db } from "./firebase-admin";
import { ApiError } from "./http";

export const COL = {
  subjects: "subjects",
  formats: "formats",
  profiles: "profiles",
  materials: "materials",
  materialKeys: "materialKeys",
  attempts: "attempts",
  audit: "auditLogs",
  meta: "meta",
  rate: "rateLimits",
} as const;

/* ------------------------------------------------------------------ seeding */

let seeded = false;

/** Seeds default subjects + format versions exactly once (transactional guard). */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const f = db();
  const markerRef = f.collection(COL.meta).doc("seed");
  await f.runTransaction(async (tx) => {
    const marker = await tx.get(markerRef);
    if (marker.exists) return;
    const now = Date.now();
    for (const fmt of DEFAULT_FORMATS) tx.set(f.collection(COL.formats).doc(fmt.id), { ...fmt, createdAt: now, updatedAt: now });
    for (const s of DEFAULT_SUBJECTS) tx.set(f.collection(COL.subjects).doc(s.code), s);
    tx.set(markerRef, { at: now, version: 1 });
  });
  seeded = true;
}

/* ---------------------------------------------------------------- subjects */

export async function listSubjects(includeArchived = false): Promise<SubjectWithFormat[]> {
  await ensureSeeded();
  const f = db();
  const [subs, fmts, mats] = await Promise.all([
    f.collection(COL.subjects).get(),
    f.collection(COL.formats).get(),
    f.collection(COL.materials).where("status", "==", "published").select("subjectCode").get(),
  ]);
  const formats = new Map(fmts.docs.map((d) => [d.id, d.data() as ExamFormat]));
  const counts = new Map<string, number>();
  for (const m of mats.docs) {
    const c = m.get("subjectCode") as string;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return subs.docs
    .map((d) => d.data() as SubjectInfo)
    .filter((s) => includeArchived || !s.archived)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((s) => ({ ...s, format: formats.get(s.activeFormatId) ?? null, publishedMaterials: counts.get(s.code) ?? 0 }));
}

export async function getSubject(code: string): Promise<SubjectInfo> {
  await ensureSeeded();
  const snap = await db().collection(COL.subjects).doc(code).get();
  if (!snap.exists) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  return snap.data() as SubjectInfo;
}

export async function getFormat(id: string): Promise<ExamFormat> {
  await ensureSeeded();
  const snap = await db().collection(COL.formats).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "format_not_found", "Imtihon formati topilmadi.");
  return snap.data() as ExamFormat;
}

/* ---------------------------------------------------------------- profiles */

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await db().collection(COL.profiles).doc(uid).get();
  return snap.exists ? (snap.data() as Profile) : null;
}

/** Allocates a unique, sequential Candidate ID like MM-26-000123 inside a transaction. */
export async function createProfile(
  uid: string,
  email: string,
  data: Pick<Profile, "firstName" | "lastName" | "phone" | "region" | "institution" | "grade">,
  emailVerified: boolean,
): Promise<Profile> {
  const f = db();
  const profileRef = f.collection(COL.profiles).doc(uid);
  const counterRef = f.collection(COL.meta).doc("candidateCounter");
  return f.runTransaction(async (tx) => {
    const [existing, counter] = await Promise.all([tx.get(profileRef), tx.get(counterRef)]);
    if (existing.exists) return existing.data() as Profile;
    const next = ((counter.exists ? (counter.get("value") as number) : 0) || 0) + 1;
    const yy = new Date().getFullYear().toString().slice(-2);
    const now = Date.now();
    const profile: Profile = {
      uid,
      email,
      candidateId: `MM-${yy}-${String(next).padStart(6, "0")}`,
      ...data,
      status: "active",
      emailVerified,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    };
    tx.set(counterRef, { value: next }, { merge: true });
    tx.set(profileRef, profile);
    return profile;
  });
}

/* --------------------------------------------------------------- materials */

export async function getMaterial(id: string): Promise<Material> {
  const snap = await db().collection(COL.materials).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "material_not_found", "Test materiali topilmadi.");
  return snap.data() as Material;
}

export function toPublicMaterial(m: Material): PublicMaterial {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    subjectCode: m.subjectCode,
    subjectName: m.subjectName,
    mode: m.mode,
    timed: m.timed,
    format: m.format,
    structure: m.structure,
    attemptLimit: m.attemptLimit,
    publishedAt: m.publishedAt,
  };
}

/* ------------------------------------------------------------------- audit */

export async function audit(action: string, target: string, details: Record<string, unknown> = {}, actor = "admin"): Promise<void> {
  try {
    await db().collection(COL.audit).add({ at: Date.now(), actor, action, target, details });
  } catch (e) {
    console.error("[audit] failed to write", action, target, e);
  }
}

/* -------------------------------------------------------------- rate limit */

/**
 * Fixed-window rate limiter backed by Firestore so it holds across serverless instances.
 * Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const f = db();
  const ref = f.collection(COL.rate).doc(key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 300));
  return f.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const start = snap.exists ? (snap.get("windowStart") as number) : 0;
    const count = snap.exists ? (snap.get("count") as number) : 0;
    if (!snap.exists || now - start >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1, expiresAt: now + windowMs });
      return true;
    }
    if (count >= limit) return false;
    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
}

export async function resetRateLimit(key: string): Promise<void> {
  await db()
    .collection(COL.rate)
    .doc(key.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 300))
    .delete()
    .catch(() => undefined);
}
