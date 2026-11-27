import "server-only";
import * as attemptsList from "@/app/api/admin/attempts/route";
import * as attemptOne from "@/app/api/admin/attempts/[id]/route";
import * as attemptPublish from "@/app/api/admin/attempts/[id]/publish/route";
import * as attemptReview from "@/app/api/admin/attempts/[id]/review/route";
import * as auditList from "@/app/api/admin/audit/route";
import * as formatsList from "@/app/api/admin/formats/route";
import * as formatOne from "@/app/api/admin/formats/[id]/route";
import * as materialsList from "@/app/api/admin/materials/route";
import * as materialOne from "@/app/api/admin/materials/[id]/route";
import * as paymentSettings from "@/app/api/admin/payment-settings/route";
import * as payments from "@/app/api/admin/payments/route";
import * as siteTheme from "@/app/api/admin/site-theme/route";
import * as stats from "@/app/api/admin/stats/route";
import * as subjectsList from "@/app/api/admin/subjects/route";
import * as subjectOne from "@/app/api/admin/subjects/[code]/route";
import * as usersList from "@/app/api/admin/users/route";
import * as userOne from "@/app/api/admin/users/[uid]/route";

/*
 * The agent's "hands": every admin API the panel itself uses, called in-process with the
 * current admin's session — so the agent goes through exactly the same validation, audit
 * logging and business rules as a human admin. Nothing else (no DB/storage access, no
 * secrets, no login/logout, no agent endpoints) is reachable.
 */
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Mod = Partial<Record<Method, unknown>>;

interface Tool {
  pattern: string;
  mod: Mod;
  /** Methods that must wait for a human admin's confirmation in the panel. */
  confirm?: Method[];
  doc: string;
}

const TOOLS: Tool[] = [
  { pattern: "/api/admin/stats", mod: stats, doc: "GET — umumiy statistika (foydalanuvchilar, urinishlar, tekshiruv navbati, oxirgi audit)." },
  { pattern: "/api/admin/materials", mod: materialsList, doc: "GET — barcha test materiallari (id, title, status, subjectCode, price…)." },
  {
    pattern: "/api/admin/materials/:id",
    mod: materialOne,
    confirm: ["DELETE"],
    doc: 'GET — material + kalit. PATCH {meta?:{title,description,revealAnswers,attemptLimit,price}, status?:"draft"|"published"|"archived", key?} — narx (so‘m, 0 = bepul), e’lon qilish, arxivlash. meta yuborilsa title, description, revealAnswers, attemptLimit ham bo‘lishi shart (avval GET qiling). DELETE — o‘chirish (TASDIQ talab qilinadi).',
  },
  { pattern: "/api/admin/attempts", mod: attemptsList, doc: "GET ?status=&subject=&materialId= — urinishlar ro‘yxati (status: in_progress|submitted|pending_review|graded|published)." },
  { pattern: "/api/admin/attempts/:id", mod: attemptOne, doc: "GET — bitta urinish (javoblar, baholash, fayllar)." },
  {
    pattern: "/api/admin/attempts/:id/review",
    mod: attemptReview,
    doc: 'POST {o1?:{"12":"correct"|"incorrect"}, o2?:{"36":{criteria:[{id,score,comment}],comment}}} — shubhali javob va yozma ishlarni baholash.',
  },
  { pattern: "/api/admin/attempts/:id/publish", mod: attemptPublish, doc: 'POST {action:"publish"|"unpublish"} — natijani e’lon qilish.' },
  { pattern: "/api/admin/users", mod: usersList, doc: "GET ?q=&status=active|suspended — nomzodlar ro‘yxati." },
  { pattern: "/api/admin/users/:uid", mod: userOne, confirm: ["PATCH"], doc: 'GET — nomzod va urinishlari. PATCH {action:"suspend"|"activate"|"reset_password"} (TASDIQ talab qilinadi).' },
  { pattern: "/api/admin/formats", mod: formatsList, doc: "GET — imtihon formatlari. POST — format versiyasini nusxalash." },
  { pattern: "/api/admin/formats/:id", mod: formatOne, doc: "PATCH — formatni tahrirlash (to‘liq obyekt; avval GET /api/admin/formats)." },
  { pattern: "/api/admin/subjects", mod: subjectsList, doc: "POST — yangi fan qo‘shish." },
  { pattern: "/api/admin/subjects/:code", mod: subjectOne, doc: "PATCH {name,description,order,activeFormatId,archived} — fanni tahrirlash." },
  { pattern: "/api/admin/audit", mod: auditList, doc: "GET — oxirgi 300 ta audit yozuvi." },
  { pattern: "/api/admin/site-theme", mod: siteTheme, doc: 'GET — joriy dizayn. PUT {theme:"default"|"aurora"|"samarqand"|"minimal"|"terminal"|"konfet"} — sayt dizaynini almashtirish.' },
  { pattern: "/api/admin/payments", mod: payments, confirm: ["POST"], doc: 'GET — to‘lov so‘rovlari (status pending|approved|rejected). POST {uid,materialId,decision:"approved"|"rejected"} (TASDIQ talab qilinadi — pul bilan bog‘liq).' },
  { pattern: "/api/admin/payment-settings", mod: paymentSettings, confirm: ["PUT"], doc: "GET — karta rekvizitlari. PUT {cardNumber,cardHolder,instructions} (TASDIQ talab qilinadi)." },
];

export const TOOL_DOCS = TOOLS.map((t) => `${t.pattern} — ${t.doc}`).join("\n");

export interface AgentAction {
  method: Method;
  path: string;
  body?: unknown;
  reason?: string;
}

function match(path: string): { tool: Tool; params: Record<string, string> } | null {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  for (const tool of TOOLS) {
    const a = tool.pattern.split("/");
    const b = clean.split("/");
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(":")) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(b[i])) ok = false;
        else params[a[i].slice(1)] = b[i];
      } else if (a[i] !== b[i]) ok = false;
    }
    if (ok) return { tool, params };
  }
  return null;
}

/** Checks an action without running it. */
export function classify(a: AgentAction): { ok: true; needsConfirm: boolean } | { ok: false; error: string } {
  const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];
  if (!a || typeof a.path !== "string" || !METHODS.includes(a.method)) return { ok: false, error: "method/path noto‘g‘ri" };
  if (a.path.length > 300) return { ok: false, error: "path juda uzun" };
  const m = match(a.path);
  if (!m) return { ok: false, error: `ruxsat etilmagan yo‘l: ${a.path}` };
  if (typeof m.tool.mod[a.method] !== "function") return { ok: false, error: `${a.method} bu yo‘lda yo‘q` };
  return { ok: true, needsConfirm: a.method === "DELETE" || !!m.tool.confirm?.includes(a.method) };
}

/** Runs an (already classified) action through the real admin route handler. */
export async function runAction(a: AgentAction, origin: string): Promise<{ status: number; data: unknown }> {
  const m = match(a.path);
  if (!m) return { status: 400, data: { error: "ruxsat etilmagan yo‘l" } };
  const handler = m.tool.mod[a.method] as Handler;
  const hasBody = a.method !== "GET" && a.method !== "DELETE" && a.body !== undefined;
  const req = new Request(new URL(a.path, origin), {
    method: a.method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(a.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(m.params) });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data };
}
