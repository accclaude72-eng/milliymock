import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { levelOf, makeSerial, makeToken, maskName, pdfSafe, uzDate } from "@/lib/certificate";
import type { Attempt } from "@/lib/types";
import { ApiError } from "./http";
import { notifyUser, siteBase } from "./notifications";
import { getProfile } from "./repo";
import { T, getDoc, must, sb } from "./supabase";

export interface CertificateRow {
  id: string;
  serial: string;
  verify_code: string;
  user_id: string;
  attempt_id: string;
  material_id: string;
  subject_code: string;
  material_title: string;
  candidate_name: string;
  candidate_id: string | null;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  level: string | null;
  issued_at: string;
  status: "valid" | "revoked";
  revoked_at: string | null;
  revoked_reason: string | null;
}

/** Only a published, full mock (not a practice set) earns a certificate. */
export function eligible(a: Attempt): boolean {
  return a.status === "published" && a.mode === "full" && !!a.grading?.summary;
}

export const verifyUrl = (code: string, origin?: string) => `${siteBase(origin)}/sertifikat/${code}`;

/** Issues (or returns the existing) certificate for one of the student's attempts. */
export async function issueCertificate(uid: string, attemptId: string): Promise<CertificateRow> {
  const existing = must(await sb().from("certificates").select("*").eq("attempt_id", attemptId).maybeSingle(), "cert by attempt") as CertificateRow | null;
  if (existing) {
    if (existing.user_id !== uid) throw new ApiError(404, "not_found", "Natija topilmadi.");
    return existing;
  }
  const a = await getDoc<Attempt>(T.attempts, attemptId);
  if (!a || a.uid !== uid) throw new ApiError(404, "not_found", "Natija topilmadi.");
  if (!eligible(a)) throw new ApiError(409, "not_eligible", "Sertifikat faqat e’lon qilingan to‘liq mock natijasiga beriladi.");
  const p = await getProfile(uid);
  const name = `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() || a.candidateName;
  const s = a.grading!.summary;
  const percent = Math.round(s.percent * 10) / 10;
  for (let i = 0; i < 5; i++) {
    const row = {
      serial: makeSerial(new Date().getUTCFullYear(), randomBytes(6)),
      verify_code: makeToken(24, randomBytes(24)),
      user_id: uid,
      attempt_id: attemptId,
      material_id: a.materialId,
      subject_code: a.subjectCode,
      material_title: a.materialTitle,
      candidate_name: name.slice(0, 120),
      candidate_id: a.candidateId,
      score: s.score,
      max_score: s.max,
      percent,
      level: levelOf(percent).code,
    };
    const { data, error } = await sb().from("certificates").insert(row).select("*").single();
    if (!error) {
      const c = data as CertificateRow;
      await notifyUser(uid, "results", `cert:${c.id}`, `🎓 <b>Sertifikat tayyor</b>\n${a.materialTitle}\nNatija: <b>${percent}%</b> · seriya ${c.serial}`, {
        buttons: [{ text: "Sertifikatni tekshirish", url: verifyUrl(c.verify_code) }],
      });
      return c;
    }
    if (error.code !== "23505") throw new Error(`issue certificate: ${error.message}`);
    // Unique clash: either the same attempt was issued in parallel (return it) or a serial clashed (retry).
    const again = must(await sb().from("certificates").select("*").eq("attempt_id", attemptId).maybeSingle(), "cert retry") as CertificateRow | null;
    if (again) return again;
  }
  throw new ApiError(500, "serial", "Sertifikat yaratib bo‘lmadi. Qayta urinib ko‘ring.");
}

/** A4 landscape PDF with a QR code pointing to the public verification page. */
export async function certificatePdf(c: CertificateRow, origin?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Milliy Mock sertifikat ${c.serial}`);
  doc.setAuthor("Milliy Mock");
  doc.setCreationDate(new Date(c.issued_at));
  const page = doc.addPage([842, 595]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifB = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const ink = rgb(0.08, 0.08, 0.07);
  const accent = rgb(0.72, 0.2, 0.1);
  const muted = rgb(0.4, 0.39, 0.36);
  const W = 842;

  page.drawRectangle({ x: 0, y: 0, width: W, height: 595, color: rgb(0.953, 0.941, 0.91) });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: 547, borderColor: ink, borderWidth: 1.5 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: 531, borderColor: accent, borderWidth: 0.6 });

  const center = (t: string, y: number, font = serif, size = 14, color = ink) => {
    const s = pdfSafe(t);
    page.drawText(s, { x: (W - font.widthOfTextAtSize(s, size)) / 2, y, size, font, color });
  };
  const fit = (t: string, font: typeof serif, max: number, width: number) => {
    let size = max;
    while (size > 10 && font.widthOfTextAtSize(pdfSafe(t), size) > width) size -= 1;
    return size;
  };

  center("MILLIY MOCK", 520, sans, 12, accent);
  center("MOCK NATIJA SERTIFIKATI", 488, serifB, 30);
  center("Ushbu sertifikat platformada topshirilgan mock imtihon natijasini tasdiqlaydi", 462, serif, 12, muted);
  center(c.candidate_name, 400, serifB, fit(c.candidate_name, serifB, 34, 640));
  page.drawLine({ start: { x: 220, y: 390 }, end: { x: W - 220, y: 390 }, thickness: 0.6, color: muted });
  center(c.material_title, 362, serif, fit(c.material_title, serif, 18, 640));

  const pct = Number(c.percent ?? 0);
  center(`${pct}%`, 300, serifB, 46, accent);
  center(`Xom ball: ${Number(c.score ?? 0)} / ${Number(c.max_score ?? 0)}  -  platforma bahosi: ${levelOf(pct).label}`, 276, serif, 13);

  const left = 70;
  page.drawText(pdfSafe(`Seriya: ${c.serial}`), { x: left, y: 150, size: 11, font: mono, color: ink });
  page.drawText(pdfSafe(`Berilgan sana: ${uzDate(Date.parse(c.issued_at))}`), { x: left, y: 132, size: 11, font: mono, color: ink });
  if (c.candidate_id) page.drawText(pdfSafe(`Candidate ID: ${c.candidate_id}`), { x: left, y: 114, size: 11, font: mono, color: ink });
  if (c.status === "revoked") page.drawText("BEKOR QILINGAN", { x: left, y: 184, size: 22, font: serifB, color: accent });

  const url = verifyUrl(c.verify_code, origin);
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 260, errorCorrectionLevel: "M" });
  const img = await doc.embedPng(qr);
  page.drawImage(img, { x: W - 70 - 110, y: 92, width: 110, height: 110 });
  page.drawText("Haqiqiyligini tekshirish:", { x: W - 70 - 200, y: 78, size: 9, font: sans, color: muted });
  page.drawText(pdfSafe(url.replace(/^https?:\/\//, "")), { x: W - 70 - 200, y: 66, size: 7, font: mono, color: muted, maxWidth: 200 });

  const note = "Bu rasmiy davlat sertifikati emas. Milliy Mock platformasi bergan mock natija sertifikati; ball xom ball / platforma bahosi sifatida ko'rsatilgan.";
  page.drawText(pdfSafe(note), { x: left, y: 52, size: 8.5, font: sans, color: muted, maxWidth: 480, lineHeight: 11 });
  return doc.save();
}

const ipHash = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.SUPABASE_SECRET_KEY ?? "mm"}:cert:${ip}`)
    .digest("hex")
    .slice(0, 32);

/** Public lookup: limited fields only (masked name), and every check is logged. */
export async function verifyPublic(code: string, ip: string) {
  const clean = /^[A-Za-z0-9]{16,32}$/.test(code) ? code : null;
  const c = clean ? (must(await sb().from("certificates").select("*").eq("verify_code", clean).maybeSingle(), "verify") as CertificateRow | null) : null;
  await sb()
    .from("certificate_checks")
    .insert({ certificate_id: c?.id ?? null, code_tried: code.slice(0, 64), found: !!c, ip_hash: ipHash(ip) });
  if (!c) return null;
  return {
    serial: c.serial,
    name: maskName(c.candidate_name),
    title: c.material_title,
    subjectCode: c.subject_code,
    percent: Number(c.percent ?? 0),
    score: Number(c.score ?? 0),
    maxScore: Number(c.max_score ?? 0),
    level: levelOf(Number(c.percent ?? 0)).label,
    issuedAt: Date.parse(c.issued_at),
    status: c.status,
    revokedReason: c.status === "revoked" ? c.revoked_reason : null,
  };
}

/** Called when an admin un-publishes a result: its certificate stops being valid. */
export async function revokeForAttempt(attemptId: string, reason: string): Promise<void> {
  must(
    await sb().from("certificates").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: reason }).eq("attempt_id", attemptId).eq("status", "valid"),
    "revoke for attempt",
  );
}
