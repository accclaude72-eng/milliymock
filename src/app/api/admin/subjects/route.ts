import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit, ensureSeeded } from "@/lib/server/repo";
import { T, getDoc, insertDoc } from "@/lib/server/supabase";
import type { ExamFormat, SubjectInfo } from "@/lib/formats";

const Create = z.object({
  code: z.string().regex(/^[a-z0-9-]{2,40}$/, "faqat kichik lotin harflari, raqam va '-'"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  order: z.number().int().min(0).max(999).default(50),
  /** New subjects start from a copy of an existing format version, then get edited. */
  templateFormatId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  version: z.string().trim().min(1).max(20),
});

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  await ensureSeeded();
  const body = Create.parse(await readJson(req));
  const formatId = `${body.code}-${body.version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  {
    const [sub, tpl, dst] = await Promise.all([
      getDoc<SubjectInfo>(T.subjects, body.code),
      getDoc<ExamFormat>(T.formats, body.templateFormatId),
      getDoc<ExamFormat>(T.formats, formatId),
    ]);
    if (sub) throw new ApiError(409, "exists", "Bunday kodli fan mavjud.");
    if (!tpl) throw new ApiError(404, "not_found", "Shablon format topilmadi.");
    if (dst) throw new ApiError(409, "exists", `Format ${formatId} allaqachon mavjud.`);
    const now = Date.now();
    const fmt: ExamFormat = {
      ...tpl,
      id: formatId,
      subjectCode: body.code,
      subjectName: body.name,
      version: body.version,
      label: `${body.name} · ${body.version}`,
      topics: [],
      sourceUrl: "",
      sourceTitle: "",
      assessmentNote: "Ushbu fan uchun rasmiy spetsifikatsiyani tekshirib, format parametrlarini kiriting.",
      raschParameterSetId: null,
      createdAt: now,
      updatedAt: now,
    };
    const subject: SubjectInfo = { code: body.code, name: body.name, description: body.description, order: body.order, activeFormatId: formatId, archived: false };
    if (!(await insertDoc(T.formats, formatId, fmt))) throw new ApiError(409, "exists", `Format ${formatId} allaqachon mavjud.`);
    if (!(await insertDoc(T.subjects, body.code, subject))) throw new ApiError(409, "exists", "Bunday kodli fan mavjud.");
  }
  await audit("subject.create", `subjects/${body.code}`, { formatId });
  return ok({ code: body.code, formatId }, 201);
});
