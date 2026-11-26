import "server-only";
import { NextResponse, connection } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: NO_STORE });
}

export function fail(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: NO_STORE });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps a route handler: forces request-time execution (never prerendered at build time),
 * maps known errors to a predictable JSON shape and logs unexpected ones server-side only.
 */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    await connection();
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return fail(400, "invalid_input", first ? `Noto‘g‘ri ma’lumot: ${first.path.join(".") || "so'rov"} — ${first.message}` : "Noto‘g‘ri ma’lumot.");
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, e);
      return fail(500, "internal", "Serverda kutilmagan xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.");
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "So‘rov tanasi JSON formatida emas.");
  }
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Basic same-origin check for state-changing cookie-authenticated requests (CSRF defence in depth). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; cookie is SameSite=Strict anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "bad_origin", "So‘rov manbasi ruxsat etilmagan.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "bad_origin", "So‘rov manbasi ruxsat etilmagan.");
  }
}
