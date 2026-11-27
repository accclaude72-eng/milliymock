import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ALLOWED_O2_TYPES, MAX_O2_FILES, MAX_O2_FILE_BYTES, playerView, registerFile, removeFile, withAttempt } from "@/lib/server/attempts";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { deleteObject, objectMeta, uploadUrl } from "@/lib/server/storage";
import { BUCKET } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";
import { sectionIndexOf, taskTypeOf } from "@/lib/formats";

const Prepare = z.object({
  action: z.literal("prepare"),
  n: z.string().regex(/^\d{1,3}$/),
  name: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_O2_FILE_BYTES),
  contentType: z.enum(ALLOWED_O2_TYPES as [string, ...string[]]),
});
const Register = z.object({
  action: z.literal("register"),
  n: z.string().regex(/^\d{1,3}$/),
  path: z.string().min(10).max(400),
  name: z.string().min(1).max(200),
});

/**
 * Two steps: "prepare" checks the attempt and returns a one-time signed upload URL into the
 * private `submissions` bucket; after the browser uploads, "register" re-checks the REAL
 * stored object (size/type) and attaches it to the attempt.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const raw = await readJson(req);
  const prefix = `${user.uid}/${id}/`;

  if ((raw as { action?: string })?.action === "prepare") {
    const body = Prepare.parse(raw);
    const a = await withAttempt(id, user.uid, () => ({}));
    const num = Number(body.n);
    if (a.status !== "in_progress") throw new ApiError(409, "time_over", "Vaqt tugagan — fayl qabul qilinmaydi.");
    if (taskTypeOf(a.format, num) !== "O2") throw new ApiError(400, "not_o2", "Fayl faqat yozma ish topshirig‘iga yuklanadi.");
    if (sectionIndexOf(a.format, num) !== a.timing.index) throw new ApiError(409, "section_locked", "Bu bo‘lim hozir ochiq emas.");
    if ((a.o2Files?.[body.n]?.length ?? 0) >= MAX_O2_FILES) throw new ApiError(400, "too_many_files", `Har bir topshiriqqa ko‘pi bilan ${MAX_O2_FILES} ta fayl.`);
    const safe = body.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "fayl";
    const up = await uploadUrl(BUCKET.submissions, `${prefix}${body.n}/${randomUUID()}-${safe}`);
    return ok(up);
  }

  const body = Register.parse(raw);
  if (!body.path.startsWith(`${prefix}${body.n}/`) || body.path.includes("..")) throw new ApiError(400, "bad_path", "Fayl manzili noto‘g‘ri.");
  const meta = await objectMeta(BUCKET.submissions, body.path);
  if (!meta) throw new ApiError(400, "upload_missing", "Fayl serverda topilmadi. Qayta yuklang.");
  if (!ALLOWED_O2_TYPES.includes(meta.contentType) || meta.size > MAX_O2_FILE_BYTES || meta.size <= 0) {
    await deleteObject(BUCKET.submissions, body.path);
    throw new ApiError(400, "bad_file", "Faqat JPG, PNG yoki PDF (10 MB gacha) fayllar qabul qilinadi.");
  }
  try {
    const { attempt, meta: fm } = await registerFile(id, user.uid, body.n, { path: body.path, name: body.name, size: meta.size, contentType: meta.contentType });
    return ok({ view: playerView(attempt), file: { id: fm.id, name: fm.name } }, 201);
  } catch (e) {
    await deleteObject(BUCKET.submissions, body.path);
    throw e;
  }
});

const Remove = z.object({ n: z.string().regex(/^\d{1,3}$/), fileId: z.string().uuid() });

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Remove.parse(await readJson(req));
  const { attempt, removed } = await removeFile(id, user.uid, body.n, body.fileId);
  if (removed) await deleteObject(BUCKET.submissions, (removed as { path: string }).path);
  return ok({ view: playerView(attempt) });
});
