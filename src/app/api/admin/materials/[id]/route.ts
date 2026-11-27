import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit, countAttempts, getKey } from "@/lib/server/repo";
import { HtmlUploadSchema, KeySchema, MaterialMetaSchema, StructureSchema } from "@/lib/server/schemas";
import { deleteObject, objectMeta } from "@/lib/server/storage";
import { BUCKET, T, deleteDoc, getDoc, upsertDoc } from "@/lib/server/supabase";
import { validateKey } from "@/lib/sheet";
import type { AnswerKey } from "@/lib/grading";
import type { Material } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const [m, k, attempts] = await Promise.all([getDoc<Material>(T.materials, id), getKey(id), countAttempts(id)]);
  if (!m) throw new ApiError(404, "not_found", "Material topilmadi.");
  return { material: { ...m, attemptsCount: attempts }, key: (k?.items ?? {}) as AnswerKey };
}

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  return ok(await load(id));
});

const Patch = z.object({
  meta: MaterialMetaSchema.optional(),
  structure: StructureSchema.optional(),
  key: KeySchema.optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  html: HtmlUploadSchema.optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const body = Patch.parse(await readJson(req));
  let newHtmlSize = 0;
  if (body.html) {
    const meta = await objectMeta(BUCKET.booklets, body.html.path);
    if (!meta || !meta.contentType.startsWith("text/html")) throw new ApiError(400, "upload_missing", "Yangi HTML fayl topilmadi yoki HTML emas.");
    if (meta.size > 50 * 1024 * 1024) throw new ApiError(400, "too_large", "HTML fayl 50 MB dan katta.");
    newHtmlSize = meta.size;
  }

  const { material: m, key: oldKey } = await load(id);
  const used = (m.attemptsCount ?? 0) > 0;
  const now = Date.now();
  const patch: Partial<Material> = { updatedAt: now };
  const key = (body.key as AnswerKey | undefined) ?? oldKey;
  let oldHtmlPath: string | null = null;

  if (body.meta) Object.assign(patch, body.meta);
  if (body.structure) {
    if (used) throw new ApiError(409, "locked", "Bu material bo‘yicha urinishlar mavjud — javoblar varaqasi tuzilishini o‘zgartirib bo‘lmaydi. Materialni nusxalab yangisini yarating.");
    patch.structure = body.structure;
  }
  if (body.html) {
    oldHtmlPath = used ? null : (m.html?.path ?? null); // keep the old file if attempts reference it
    patch.html = { ...body.html, size: newHtmlSize, uploadedAt: now };
  }
  const problems = validateKey(m.format, patch.structure ?? m.structure, key);
  patch.keyStatus = { complete: problems.length === 0, problems };
  if ((body.status ?? m.status) === "published") {
    if (problems.length) throw new ApiError(409, "key_incomplete", `E’lon qilish uchun javoblar kaliti to‘liq bo‘lishi kerak (${problems.length} ta muammo).`);
    if (!(patch.html ?? m.html)) throw new ApiError(409, "no_booklet", "HTML test kitobchasi yuklanmagan.");
  }
  if (body.status && body.status !== m.status) {
    patch.status = body.status;
    if (body.status === "published") patch.publishedAt = now;
  }

  // Key first: a material can never become published with a stale key.
  if (body.key) await upsertDoc(T.keys, id, { items: key, updatedAt: now });
  const { attemptsCount: _c, ...stored } = { ...m, ...patch };
  void _c;
  await upsertDoc(T.materials, id, stored);
  if (body.html && oldHtmlPath && oldHtmlPath !== body.html.path) await deleteObject(BUCKET.booklets, oldHtmlPath);

  await audit(body.status ? `material.status.${body.status}` : "material.update", `materials/${id}`, {
    fields: Object.keys(body),
    statusBefore: m.status,
    statusAfter: patch.status ?? m.status,
  });
  return ok(await load(id));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await params;
  const { material } = await load(id);
  if ((material.attemptsCount ?? 0) > 0) {
    throw new ApiError(409, "has_attempts", "Bu material bo‘yicha urinishlar bor — tarixni saqlash uchun o‘chirib bo‘lmaydi. Uni arxivlang.");
  }
  await deleteDoc(T.materials, id); // material_keys row cascades
  if (material.html?.path) await deleteObject(BUCKET.booklets, material.html.path);
  await audit("material.delete", `materials/${id}`, { title: material.title });
  return ok({ deleted: true });
});
