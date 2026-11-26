import { z } from "zod";
import { ALLOWED_O2_TYPES, MAX_O2_FILE_BYTES, playerView, registerFile, removeFile } from "@/lib/server/attempts";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { deleteObject, objectMeta } from "@/lib/server/storage";
import { requireCandidate } from "@/lib/server/user-auth";

const Register = z.object({
  n: z.string().regex(/^\d{1,3}$/),
  path: z.string().min(10).max(400),
  name: z.string().min(1).max(200),
});

/**
 * Registers a file the candidate already uploaded straight to Firebase Storage
 * (Storage rules restrict the path to their own uid). The server re-checks the
 * real object metadata — never trusting client-reported size or type.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Register.parse(await readJson(req));
  const prefix = `submissions/${user.uid}/${id}/${body.n}/`;
  if (!body.path.startsWith(prefix) || body.path.includes("..")) throw new ApiError(400, "bad_path", "Fayl manzili noto‘g‘ri.");
  const meta = await objectMeta(body.path);
  if (!meta) throw new ApiError(400, "upload_missing", "Fayl serverda topilmadi. Qayta yuklang.");
  if (!ALLOWED_O2_TYPES.includes(meta.contentType) || meta.size > MAX_O2_FILE_BYTES || meta.size <= 0) {
    await deleteObject(body.path);
    throw new ApiError(400, "bad_file", "Faqat JPG, PNG yoki PDF (10 MB gacha) fayllar qabul qilinadi.");
  }
  try {
    const { attempt, meta: fm } = await registerFile(id, user.uid, body.n, { path: body.path, name: body.name, size: meta.size, contentType: meta.contentType });
    return ok({ view: playerView(attempt), file: { id: fm.id, name: fm.name } }, 201);
  } catch (e) {
    await deleteObject(body.path);
    throw e;
  }
});

const Remove = z.object({ n: z.string().regex(/^\d{1,3}$/), fileId: z.string().uuid() });

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { user } = await requireCandidate(req);
  const body = Remove.parse(await readJson(req));
  const { attempt, removed } = await removeFile(id, user.uid, body.n, body.fileId);
  if (removed) await deleteObject((removed as { path: string }).path);
  return ok({ view: playerView(attempt) });
});
