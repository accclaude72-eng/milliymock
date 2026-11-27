import "server-only";
import { DEFAULT_FORMATS, DEFAULT_SUBJECTS, type ExamFormat, type SubjectInfo } from "../formats";
import type { Attempt, Material, MaterialKeyDoc, Profile, PublicMaterial, SubjectWithFormat } from "../types";
import { ApiError } from "./http";
import { T, getDoc, must, sb } from "./supabase";

export { T } from "./supabase";

/* ------------------------------------------------------------------ seeding */

let seeded = false;

/** Inserts the default subjects + format versions once. Never overwrites admin edits. */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const now = Date.now();
  must(
    await sb()
      .from(T.formats)
      .upsert(DEFAULT_FORMATS.map((f) => ({ id: f.id, doc: { ...f, createdAt: now, updatedAt: now } })), { onConflict: "id", ignoreDuplicates: true }),
    "seed formats",
  );
  must(
    await sb()
      .from(T.subjects)
      .upsert(DEFAULT_SUBJECTS.map((s) => ({ id: s.code, doc: s })), { onConflict: "id", ignoreDuplicates: true }),
    "seed subjects",
  );
  seeded = true;
}

/* ---------------------------------------------------------------- subjects */

export async function allFormats(): Promise<ExamFormat[]> {
  await ensureSeeded();
  return (must(await sb().from(T.formats).select("doc"), "list formats") ?? []).map((r) => r.doc as ExamFormat);
}

export async function listSubjects(includeArchived = false): Promise<SubjectWithFormat[]> {
  await ensureSeeded();
  const [subs, fmts, mats] = await Promise.all([
    sb().from(T.subjects).select("doc"),
    sb().from(T.formats).select("doc"),
    sb().from(T.materials).select("subject_code").eq("status", "published"),
  ]);
  const formats = new Map((must(fmts, "formats") ?? []).map((r) => [(r.doc as ExamFormat).id, r.doc as ExamFormat]));
  const counts = new Map<string, number>();
  for (const m of must(mats, "materials") ?? []) counts.set(m.subject_code, (counts.get(m.subject_code) ?? 0) + 1);
  return (must(subs, "subjects") ?? [])
    .map((r) => r.doc as SubjectInfo)
    .filter((s) => includeArchived || !s.archived)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((s) => ({ ...s, format: formats.get(s.activeFormatId) ?? null, publishedMaterials: counts.get(s.code) ?? 0 }));
}

export async function getSubject(code: string): Promise<SubjectInfo> {
  await ensureSeeded();
  const s = await getDoc<SubjectInfo>(T.subjects, code);
  if (!s) throw new ApiError(404, "subject_not_found", "Fan topilmadi.");
  return s;
}

export async function getFormat(id: string): Promise<ExamFormat> {
  await ensureSeeded();
  const f = await getDoc<ExamFormat>(T.formats, id);
  if (!f) throw new ApiError(404, "format_not_found", "Imtihon formati topilmadi.");
  return f;
}

/* ---------------------------------------------------------------- profiles */

export async function getProfile(uid: string): Promise<Profile | null> {
  return getDoc<Profile>(T.profiles, uid);
}

/** Creates the profile with a unique sequential Candidate ID like MM-26-000123 (idempotent). */
export async function createProfile(
  uid: string,
  email: string,
  data: Pick<Profile, "firstName" | "lastName" | "phone" | "region" | "institution" | "grade">,
  emailVerified: boolean,
): Promise<Profile> {
  const existing = await getProfile(uid);
  if (existing) return existing;
  const next = must(await sb().rpc("next_candidate_number"), "candidate number") as number;
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
  const { error } = await sb().from(T.profiles).insert({ id: uid, doc: profile });
  if (error?.code === "23505") return (await getProfile(uid))!; // created concurrently
  must({ data: null, error }, "insert profile");
  return profile;
}

export async function saveProfile(p: Profile): Promise<void> {
  must(await sb().from(T.profiles).update({ doc: p, updated_at: new Date().toISOString() }).eq("id", p.uid), "update profile");
}

/* --------------------------------------------------------------- materials */

export async function getMaterial(id: string): Promise<Material> {
  const m = await getDoc<Material>(T.materials, id);
  if (!m) throw new ApiError(404, "material_not_found", "Test materiali topilmadi.");
  return m;
}

export async function getKey(materialId: string): Promise<MaterialKeyDoc | null> {
  return getDoc<MaterialKeyDoc>(T.keys, materialId);
}

export async function countAttempts(materialId: string): Promise<number> {
  const r = await sb().from(T.attempts).select("id", { count: "exact", head: true }).eq("material_id", materialId);
  must(r, "count attempts");
  return r.count ?? 0;
}

export async function attemptsOf(filter: { uid?: string; materialId?: string }): Promise<Attempt[]> {
  let q = sb().from(T.attempts).select("doc");
  if (filter.uid) q = q.eq("user_id", filter.uid);
  if (filter.materialId) q = q.eq("material_id", filter.materialId);
  return (must(await q.order("created_ms", { ascending: false }), "list attempts") ?? []).map((r) => r.doc as Attempt);
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
  const { error } = await sb().from(T.audit).insert({ actor, action, target, details });
  if (error) console.error("[audit] failed to write", action, target, error);
}

/* -------------------------------------------------------------- rate limit */

/** Atomic fixed-window rate limiter in Postgres (holds across serverless instances). */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return must(await sb().rpc("rate_limit_hit", { p_key: key.slice(0, 300), p_limit: limit, p_window_ms: windowMs }), "rate limit") as boolean;
}

export async function resetRateLimit(key: string): Promise<void> {
  await sb().rpc("rate_limit_reset", { p_key: key.slice(0, 300) });
}
