import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit } from "@/lib/server/repo";
import { HtmlUploadSchema, KeySchema, MaterialMetaSchema, StructureSchema } from "@/lib/server/schemas";
import { deleteObject, objectMeta } from "@/lib/server/storage";
import { validateKey } from "@/lib/sheet";
import type { AnswerKey } from "@/lib/grading";
import type { Material, MaterialKeyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const f = db();
  const [m, k] = await Promise.all([f.collection(COL.materials).doc(id).get(), f.collection(COL.materialKeys).doc(id).get()]);
  if (!m.exists) throw new ApiError(404, "not_found", "Material topilmadi.");
  return { material: m.data() as Material, key: (k.exists ? (k.data() as MaterialKeyDoc).items : {}) as AnswerKey };
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
  const f = db();
  const matRef = f.collection(COL.materials).doc(id);
  const keyRef = f.collection(COL.materialKeys).doc(id);
  let oldHtmlPath: string | null = null;
  let newHtmlSize = 0;
  if (body.html) {
    const meta = await objectMeta(body.html.path);
    if (!meta || !meta.contentType.startsWith("text/html")) throw new ApiError(400, "upload_missing", "Yangi HTML fayl topilmadi yoki HTML emas.");
    if (meta.size > 50 * 1024 * 1024) throw new ApiError(400, "too_large", "HTML fayl 50 MB dan katta.");
    newHtmlSize = meta.size;
  }

  const result = await f.runTransaction(async (tx) => {
    const [ms, ks] = await Promise.all([tx.get(matRef), tx.get(keyRef)]);
    if (!ms.exists) throw new ApiError(404, "not_found", "Material topilmadi.");
    const m = ms.data() as Material;
    const now = Date.now();
    const patch: Partial<Material> = { updatedAt: now };
    let key = (ks.exists ? (ks.data() as MaterialKeyDoc).items : {}) as AnswerKey;

    if (body.meta) Object.assign(patch, body.meta);
    if (body.structure) {
      if ((m.attemptsCount ?? 0) > 0) throw new ApiError(409, "locked", "Bu material bo‘yicha urinishlar mavjud — javoblar varaqasi tuzilishini o‘zgartirib bo‘lmaydi. Materialni nusxalab yangisini yarating.");
      patch.structure = body.structure;
    }
    if (body.key) {
      key = body.key as AnswerKey;
      tx.set(keyRef, { items: key, updatedAt: now });
    }
    if (body.html) {
      oldHtmlPath = (m.attemptsCount ?? 0) > 0 ? null : (m.html?.path ?? null); // keep old file if attempts reference it
      patch.html = { ...body.html, size: newHtmlSize, uploadedAt: now };
    }
    const structure = patch.structure ?? m.structure;
    const problems = validateKey(m.format, structure, key);
    patch.keyStatus = { complete: problems.length === 0, problems };

    const nextStatus = body.status ?? m.status;
    if (nextStatus === "published") {
      if (problems.length) throw new ApiError(409, "key_incomplete", `E’lon qilish uchun javoblar kaliti to‘liq bo‘lishi kerak (${problems.length} ta muammo).`);
      if (!(patch.html ?? m.html)) throw new ApiError(409, "no_booklet", "HTML test kitobchasi yuklanmagan.");
    }
    if (body.status && body.status !== m.status) {
      patch.status = body.status;
      if (body.status === "published") patch.publishedAt = now;
    }
    tx.update(matRef, patch);
    return { before: m, patch };
  });

  if (body.html && oldHtmlPath && oldHtmlPath !== body.html.path) await deleteObject(oldHtmlPath);

  const changed = Object.keys(body);
  await audit(body.status ? `material.status.${body.status}` : "material.update", `materials/${id}`, {
    fields: changed,
    statusBefore: result.before.status,
    statusAfter: result.patch.status ?? result.before.status,
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
  const f = db();
  const batch = f.batch();
  batch.delete(f.collection(COL.materials).doc(id));
  batch.delete(f.collection(COL.materialKeys).doc(id));
  await batch.commit();
  if (material.html?.path) await deleteObject(material.html.path);
  await audit("material.delete", `materials/${id}`, { title: material.title });
  return ok({ deleted: true });
});
