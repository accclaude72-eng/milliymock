import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit, getFormat, getSubject } from "@/lib/server/repo";
import { BUCKET, T, insertDoc, must, newId, sb } from "@/lib/server/supabase";
import { HtmlUploadSchema, MaterialCreateSchema } from "@/lib/server/schemas";
import { deriveFormat, taskNumbers } from "@/lib/formats";
import { objectMeta } from "@/lib/server/storage";
import { defaultStructure, validateKey } from "@/lib/sheet";
import type { Material } from "@/lib/types";

const MAX_HTML_BYTES = 50 * 1024 * 1024;

export const GET = route(async () => {
  await requireAdmin();
  const [mats, atts] = await Promise.all([
    sb().from(T.materials).select("doc").order("created_ms", { ascending: false }).limit(500),
    sb().from(T.attempts).select("material_id"),
  ]);
  const counts = new Map<string, number>();
  for (const r of must(atts, "attempts") ?? []) counts.set(r.material_id, (counts.get(r.material_id) ?? 0) + 1);
  return ok(
    (must(mats, "materials") ?? []).map((r) => {
      const m = r.doc as Material;
      return {
        id: m.id,
        title: m.title,
        subjectCode: m.subjectCode,
        subjectName: m.subjectName,
        formatLabel: m.format.label,
        mode: m.mode,
        timed: m.timed,
        status: m.status,
        keyComplete: m.keyStatus.complete,
        problems: m.keyStatus.problems.length,
        attemptsCount: counts.get(m.id) ?? 0,
        fileName: m.html?.fileName ?? null,
        size: m.html?.size ?? 0,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        publishedAt: m.publishedAt,
      };
    }),
  );
});

const Create = MaterialCreateSchema.extend({
  subjectCode: z.string().regex(/^[a-z0-9-]{1,40}$/),
  html: HtmlUploadSchema,
});

/** Creates a DRAFT material from an HTML booklet already uploaded to Storage. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const body = Create.parse(await readJson(req));
  const subject = await getSubject(body.subjectCode);
  const base = await getFormat(subject.activeFormatId);
  let format = base;
  let range: { from: number; to: number } | null = null;
  let timed = true; // Full mock = official timing, always.
  if (body.mode !== "full") {
    const nums = taskNumbers(base);
    if (!body.range || body.range.from > body.range.to || !nums.includes(body.range.from) || !nums.includes(body.range.to))
      throw new ApiError(400, "bad_range", `Topshiriqlar oralig‘i 1–${base.totalTasks} ichida bo‘lishi kerak.`);
    timed = body.timed;
    if (timed && !body.minutes) throw new ApiError(400, "bad_minutes", "Vaqtli mashq uchun daqiqalar sonini kiriting.");
    range = body.range;
    format = deriveFormat(base, range.from, range.to, timed ? body.minutes : null, body.mode);
  }
  const meta = await objectMeta(BUCKET.booklets, body.html.path);
  if (!meta) throw new ApiError(400, "upload_missing", "Yuklangan HTML fayl Storage’da topilmadi. Qayta yuklang.");
  if (!meta.contentType.startsWith("text/html")) throw new ApiError(400, "bad_type", "Fayl HTML formatida emas.");
  if (meta.size > MAX_HTML_BYTES) throw new ApiError(400, "too_large", "HTML fayl 50 MB dan katta.");

  const ref = { id: newId() };
  const now = Date.now();
  const structure = defaultStructure(format);
  const material: Material = {
    id: ref.id,
    title: body.title,
    description: body.description,
    subjectCode: subject.code,
    subjectName: subject.name,
    formatId: format.id,
    format,
    mode: body.mode,
    timed,
    range,
    status: "draft",
    html: { ...body.html, size: meta.size, uploadedAt: now },
    structure,
    keyStatus: { complete: false, problems: validateKey(format, structure, {}) },
    revealAnswers: body.revealAnswers,
    attemptLimit: body.attemptLimit,
    attemptsCount: 0,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
  await insertDoc(T.materials, ref.id, material);
  await insertDoc(T.keys, ref.id, { items: {}, updatedAt: now });
  await audit("material.create", `materials/${ref.id}`, { title: material.title, subject: subject.code, file: body.html.fileName });
  return ok({ id: ref.id }, 201);
});
