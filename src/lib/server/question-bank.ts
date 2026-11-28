import "server-only";
import { parseBooklet } from "@/lib/booklet-parse";
import { type AnswerValue, type KeyItem, gradeO1, gradeY1 } from "@/lib/grading";
import type { Material } from "@/lib/types";
import { getKey } from "./repo";
import { BUCKET, T, getDoc, must, sb } from "./supabase";

/*
 * Question bank, built from real published booklets + their answer keys (no invented data).
 * Only Y1 (single choice) and O1/O (short answer) tasks are banked; matching (Y2) and
 * written work (O2) stay inside their booklets. Table `question_bank` has no RLS policy —
 * it holds correct answers, so only this server code ever reads it.
 */
export interface BankRow {
  id: string;
  material_id: string;
  n: number;
  subject_code: string;
  topic: string | null;
  type: "Y1" | "O1" | "O";
  stem_html: string;
  options: { letter: string; html: string }[];
  correct: string;
  explanation: string | null;
  difficulty: number | null;
  active: boolean;
}

/** Question shape that is safe to send to students (no correct answer). */
export interface PublicQuestion {
  id: string;
  n: number;
  materialId: string;
  subjectCode: string;
  topic: string | null;
  type: "Y1" | "O1" | "O";
  stem: string;
  options: { letter: string; html: string }[];
}

export const toPublicQuestion = (r: BankRow): PublicQuestion => ({
  id: r.id,
  n: r.n,
  materialId: r.material_id,
  subjectCode: r.subject_code,
  topic: r.topic,
  type: r.type,
  stem: r.stem_html,
  options: r.options,
});

async function downloadBooklet(path: string): Promise<string | null> {
  const { data, error } = await sb().storage.from(BUCKET.booklets).download(path);
  if (error || !data) return null;
  return data.text();
}

/** (Re)builds the bank rows of one material. Returns how many questions were stored. */
export async function syncMaterial(m: Material): Promise<number> {
  if (!m.html?.path) return 0;
  const [html, key] = await Promise.all([downloadBooklet(m.html.path), getKey(m.id)]);
  if (!html || !key) return 0;
  const parsed = new Map(parseBooklet(html).map((q) => [q.n, q]));
  const now = new Date().toISOString();
  const rows: Omit<BankRow, "explanation" | "difficulty">[] = [];
  for (const [ns, k] of Object.entries(key.items)) {
    const n = Number(ns);
    const q = parsed.get(n);
    if (!q) continue;
    if (k.type === "Y1") {
      if (q.options.length < 2) continue;
      rows.push({
        id: `${m.id}:${n}`,
        material_id: m.id,
        n,
        subject_code: m.subjectCode,
        topic: k.topic ?? null,
        type: "Y1",
        stem_html: q.stem,
        options: q.options,
        correct: k.correct.toUpperCase(),
        // Multilevel reading questions need their passage → kept for the mistake notebook, not for free practice.
        active: m.subjectCode !== "multilevel" && !q.hasFigure,
      });
    } else if ((k.type === "O1" || k.type === "O") && k.accepted.length) {
      rows.push({
        id: `${m.id}:${n}`,
        material_id: m.id,
        n,
        subject_code: m.subjectCode,
        topic: k.topic ?? null,
        type: k.type,
        stem_html: q.stem,
        options: [],
        correct: k.accepted[0] + (k.unit ? ` ${k.unit}` : ""),
        active: m.subjectCode !== "multilevel" && !q.hasFigure,
      });
    }
  }
  if (rows.length) {
    // Upsert keeps admin-written explanation / difficulty (columns not sent).
    must(await sb().from("question_bank").upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: "id" }), "bank upsert");
  }
  return rows.length;
}

/** Makes sure every given material has bank rows (lazy build on first use). */
export async function ensureBank(materialIds: string[]): Promise<void> {
  const ids = [...new Set(materialIds)];
  if (!ids.length) return;
  const have = must(await sb().from("question_bank").select("material_id").in("material_id", ids), "bank have") ?? [];
  const present = new Set(have.map((r) => r.material_id as string));
  for (const id of ids) {
    if (present.has(id)) continue;
    const m = await getDoc<Material>(T.materials, id);
    if (m && m.status !== "draft") await syncMaterial(m).catch((e) => console.error("[bank] sync failed", id, e));
  }
}

export async function bankRows(ids: string[]): Promise<Map<string, BankRow>> {
  if (!ids.length) return new Map();
  const rows = must(await sb().from("question_bank").select("*").in("id", ids), "bank rows") ?? [];
  return new Map((rows as BankRow[]).map((r) => [r.id, r]));
}

/** Grades an answer against the material's real key (same engine as exams). */
export async function gradeBankAnswer(row: BankRow, answer: string): Promise<boolean> {
  const key = (await getKey(row.material_id))?.items?.[String(row.n)] as KeyItem | undefined;
  const value = answer as AnswerValue;
  if (key?.type === "Y1") return gradeY1(value, key).status === "correct";
  if (key && (key.type === "O1" || key.type === "O")) return gradeO1(value, key).status === "correct";
  return row.type === "Y1" ? answer.trim().toUpperCase() === row.correct : answer.trim().toLowerCase() === row.correct.toLowerCase();
}

/** Materials whose correct answers may be shown to students. */
export async function revealMap(materialIds: string[]): Promise<Map<string, { reveal: boolean; title: string }>> {
  const ids = [...new Set(materialIds)];
  if (!ids.length) return new Map();
  const rows = must(await sb().from(T.materials).select("id, doc").in("id", ids), "materials reveal") ?? [];
  return new Map(rows.map((r) => [r.id as string, { reveal: !!(r.doc as Material).revealAnswers, title: (r.doc as Material).title }]));
}

/** Rebuilds the whole bank from every published material (admin action). */
export async function syncAll(): Promise<{ materials: number; questions: number }> {
  const rows = must(await sb().from(T.materials).select("doc").eq("status", "published"), "published materials") ?? [];
  let questions = 0;
  for (const r of rows) questions += await syncMaterial(r.doc as Material);
  return { materials: rows.length, questions };
}
