import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { allFormats, audit, listSubjects } from "@/lib/server/repo";
import { T, getDoc, insertDoc, must, sb } from "@/lib/server/supabase";
import type { ExamFormat } from "@/lib/formats";

export const GET = route(async () => {
  await requireAdmin();
  const [fmts, subjects, mats] = await Promise.all([allFormats(), listSubjects(true), sb().from(T.materials).select("format_id")]);
  const usage = new Map<string, number>();
  for (const r of must(mats, "materials") ?? []) usage.set(r.format_id, (usage.get(r.format_id) ?? 0) + 1);
  const formats = fmts
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
  const src = await getDoc<ExamFormat>(T.formats, body.fromId);
  if (!src) throw new ApiError(404, "not_found", "Manba format topilmadi.");
  const now = Date.now();
  const copy: ExamFormat = { ...src, id: body.newId, version: body.version, label: body.label, status: "active", createdAt: now, updatedAt: now };
  if (!(await insertDoc(T.formats, body.newId, copy))) throw new ApiError(409, "exists", "Bunday ID bilan format allaqachon mavjud.");
  await audit("format.duplicate", `formats/${body.newId}`, { from: body.fromId });
  return ok(copy, 201);
});
