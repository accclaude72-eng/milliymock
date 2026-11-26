import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit } from "@/lib/server/repo";
import type { ExamFormat, SubjectInfo } from "@/lib/formats";

const Edit = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  order: z.number().int().min(0).max(999),
  activeFormatId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  archived: z.boolean(),
});

export const PATCH = route<{ params: Promise<{ code: string }> }>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { code } = await params;
  const body = Edit.parse(await readJson(req));
  const f = db();
  const ref = f.collection(COL.subjects).doc(code);
  const [snap, fmt] = await Promise.all([ref.get(), f.collection(COL.formats).doc(body.activeFormatId).get()]);
  if (!snap.exists) throw new ApiError(404, "not_found", "Fan topilmadi.");
  if (!fmt.exists || (fmt.data() as ExamFormat).subjectCode !== code) throw new ApiError(400, "bad_format", "Tanlangan format ushbu fanga tegishli emas.");
  const before = snap.data() as SubjectInfo;
  await ref.update(body);
  await audit("subject.update", `subjects/${code}`, { before, after: body });
  return ok({ ...before, ...body });
});
