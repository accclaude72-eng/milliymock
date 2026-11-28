import { type CertificateRow, certificatePdf } from "@/lib/server/certificates";
import { ApiError, route } from "@/lib/server/http";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** The owner's certificate as a PDF (generated on request, nothing is stored). */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user } = await requireCandidate(req);
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Sertifikat topilmadi.");
  const c = must(await sb().from("certificates").select("*").eq("id", id).eq("user_id", user.uid).maybeSingle(), "cert") as CertificateRow | null;
  if (!c) throw new ApiError(404, "not_found", "Sertifikat topilmadi.");
  const pdf = await certificatePdf(c, new URL(req.url).origin);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="milliy-mock-${c.serial}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
