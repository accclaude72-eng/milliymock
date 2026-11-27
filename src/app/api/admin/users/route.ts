import { requireAdmin } from "@/lib/server/admin-session";
import { ok, route } from "@/lib/server/http";
import { T, must, sb } from "@/lib/server/supabase";
import type { Profile } from "@/lib/types";

function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function tashkent(ms: number | undefined): string {
  if (!ms) return "";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")} ${g("hour")}:${g("minute")}`;
}

export const GET = route(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status");
  const [profiles, attempts] = await Promise.all([
    sb().from(T.profiles).select("doc").order("created_ms", { ascending: false }).limit(2000),
    sb().from(T.attempts).select("user_id"),
  ]);
  const counts = new Map<string, number>();
  for (const r of must(attempts, "attempts") ?? []) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);

  let users = (must(profiles, "profiles") ?? []).map((r) => r.doc as Profile);
  if (status === "active" || status === "suspended") users = users.filter((u) => u.status === status);
  if (q)
    users = users.filter((u) =>
      [u.firstName, u.lastName, `${u.firstName} ${u.lastName}`, u.email, u.candidateId, u.phone, u.region, u.institution]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  const rows = users.map((u) => ({ ...u, attempts: counts.get(u.uid) ?? 0 }));

  if (url.searchParams.get("format") === "csv") {
    const header = ["Candidate ID", "Ism", "Familiya", "Email", "Telefon", "Hudud", "Ta’lim muassasasi", "Sinf/kurs", "Holat", "Email tasdiqlangan", "Ro‘yxatdan o‘tgan", "Urinishlar"];
    const lines = rows.map((u) =>
      [u.candidateId, u.firstName, u.lastName, u.email, u.phone, u.region, u.institution, u.grade, u.status, u.emailVerified ? "ha" : "yo‘q", tashkent(u.createdAt), u.attempts]
        .map(csvCell)
        .join(","),
    );
    const body = "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="foydalanuvchilar-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return ok({ users: rows, total: rows.length });
});
