import "server-only";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { ApiError } from "./http";

/*
 * Server-side Supabase access. Uses the SECRET (service-role) key, which bypasses RLS,
 * so it must only ever run on the server after the route's own authorization checks.
 * Supports both the new key names and the legacy ones (and the Vercel integration's names).
 */
function url(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}
function secretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function supabaseConfigured(): boolean {
  return !!(url() && secretKey());
}

const g = globalThis as unknown as { __mmSupabase?: SupabaseClient };

export function sb(): SupabaseClient {
  if (g.__mmSupabase) return g.__mmSupabase;
  if (!supabaseConfigured()) {
    throw new ApiError(503, "supabase_not_configured", "Supabase hali sozlanmagan. Administrator muhit oʻzgaruvchilarini kiritishi kerak (README ga qarang).");
  }
  g.__mmSupabase = createClient(url()!, secretKey()!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return g.__mmSupabase;
}

export const T = {
  subjects: "subjects",
  formats: "exam_formats",
  profiles: "profiles",
  materials: "materials",
  keys: "material_keys",
  attempts: "attempts",
  audit: "audit_logs",
} as const;
type Table = (typeof T)[keyof typeof T];

export const BUCKET = { booklets: "booklets", submissions: "submissions" } as const;

/** Throws a logged 500 for unexpected database errors. */
export function must<D>(res: { data: D; error: { message: string; code?: string } | null }, what: string): D {
  if (res.error) {
    console.error(`[db] ${what}:`, res.error);
    throw new ApiError(500, "db_error", "Maʼlumotlar bazasida xatolik yuz berdi. Birozdan soʻng qayta urinib koʻring.");
  }
  return res.data;
}

export async function getDoc<D>(table: Table, id: string): Promise<D | null> {
  const r = must(await sb().from(table).select("doc").eq("id", id).maybeSingle(), `get ${table}`);
  return r ? (r.doc as D) : null;
}

export async function getDocs<D>(table: Table, ids: string[]): Promise<D[]> {
  if (!ids.length) return [];
  const r = must(await sb().from(table).select("doc").in("id", ids), `getMany ${table}`);
  return (r ?? []).map((x) => x.doc as D);
}

/** Inserts a new row. Returns false (instead of throwing) on a primary/unique-key conflict. */
export async function insertDoc(table: Table, id: string, doc: unknown): Promise<boolean> {
  const { error } = await sb().from(table).insert({ id, doc });
  if (error?.code === "23505") return false;
  must({ data: null, error }, `insert ${table}`);
  return true;
}

export async function upsertDoc(table: Table, id: string, doc: unknown): Promise<void> {
  must(await sb().from(table).upsert({ id, doc, updated_at: new Date().toISOString() }), `upsert ${table}`);
}

/** Optimistic-concurrency update: succeeds only if the stored `rev` still equals `expectedRev`. */
export async function updateIfRev(table: Table, id: string, doc: unknown, expectedRev: number): Promise<boolean> {
  const r = must(
    await sb().from(table).update({ doc, updated_at: new Date().toISOString() }).eq("id", id).eq("rev", expectedRev).select("id"),
    `update ${table}`,
  );
  return (r ?? []).length === 1;
}

export async function deleteDoc(table: Table, id: string): Promise<void> {
  must(await sb().from(table).delete().eq("id", id), `delete ${table}`);
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}
