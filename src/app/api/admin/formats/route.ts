import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit, ensureSeeded, listSubjects } from "@/lib/server/repo";
import type { ExamFormat } from "@/lib/formats";

export const GET = route(async () => {
  await requireAdmin();
  await ensureSeeded();
  const [fmts, subjects, mats] = await Promise.all([
    db().collection(COL.formats).get(),
    listSubjects(true),
    db().collection(COL.materials).select("formatId").get(),
  ]);
  const usage = new Map<string, number>();
  for (const d of mats.docs) usage.set(d.get("formatId"), (usage.get(d.get("formatId")) ?? 0) + 1);
  const formats = fmts.docs
    .map((d) => d.data() as ExamFormat)
    .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode) || b.version.localeCompare(a.version))
    .map((f) => ({ ...f, materialsUsing: usage.get(f.id) ?? 0 }));
  return ok({ formats, subjects });
});

const Duplicate = z.object({
  fromId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  newId: z.string().regex(/^[a-z0-9-]{3,60}$/, "faqat kichik lotin harflari, raqam va '-'"),
  version: z.string().trim().min(1).max(20),
  label: z.string().trim().min(3).max(120),
});

/** "Duplicate Format Version": copies a format into a new, independently editable version. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const body = Duplicate.parse(await readJson(req));
  const f = db();
  const created = await f.runTransaction(async (tx) => {
    const [src, dst] = await Promise.all([tx.get(f.collection(COL.formats).doc(body.fromId)), tx.get(f.collection(COL.formats).doc(body.newId))]);
    if (!src.exists) throw new ApiError(404, "not_found", "Manba format topilmadi.");
    if (dst.exists) throw new ApiError(409, "exists", "Bunday ID bilan format allaqachon mavjud.");
    const now = Date.now();
    const copy: ExamFormat = { ...(src.data() as ExamFormat), id: body.newId, version: body.version, label: body.label, status: "active", createdAt: now, updatedAt: now };
    tx.set(f.collection(COL.formats).doc(body.newId), copy);
    return copy;
  });
  await audit("format.duplicate", `formats/${body.newId}`, { from: body.fromId });
  return ok(created, 201);
});
