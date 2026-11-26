import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { db } from "@/lib/server/firebase-admin";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { COL, audit, ensureSeeded } from "@/lib/server/repo";
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
  const f = db();
  const formatId = `${body.code}-${body.version.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  await f.runTransaction(async (tx) => {
    const [sub, tpl, dst] = await Promise.all([
      tx.get(f.collection(COL.subjects).doc(body.code)),
      tx.get(f.collection(COL.formats).doc(body.templateFormatId)),
      tx.get(f.collection(COL.formats).doc(formatId)),
    ]);
    if (sub.exists) throw new ApiError(409, "exists", "Bunday kodli fan mavjud.");
    if (!tpl.exists) throw new ApiError(404, "not_found", "Shablon format topilmadi.");
    if (dst.exists) throw new ApiError(409, "exists", `Format ${formatId} allaqachon mavjud.`);
    const now = Date.now();
    const fmt: ExamFormat = {
      ...(tpl.data() as ExamFormat),
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
    tx.set(f.collection(COL.formats).doc(formatId), fmt);
    tx.set(f.collection(COL.subjects).doc(body.code), subject);
  });
  await audit("subject.create", `subjects/${body.code}`, { formatId });
  return ok({ code: body.code, formatId }, 201);
});
