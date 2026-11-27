import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { T, getDoc, upsertDoc } from "@/lib/server/supabase";
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
  const [before, fmt] = await Promise.all([getDoc<SubjectInfo>(T.subjects, code), getDoc<ExamFormat>(T.formats, body.activeFormatId)]);
  if (!before) throw new ApiError(404, "not_found", "Fan topilmadi.");
  if (!fmt || fmt.subjectCode !== code) throw new ApiError(400, "bad_format", "Tanlangan format ushbu fanga tegishli emas.");
  await upsertDoc(T.subjects, code, { ...before, ...body });
  await audit("subject.update", `subjects/${code}`, { before, after: body });
  return ok({ ...before, ...body });
});
