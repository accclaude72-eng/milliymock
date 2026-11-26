import "server-only";
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ApiError } from "./http";

/**
 * Admin access is protected by a secret code. The code itself is NEVER stored in the
 * repository, the client bundle or even in plain text in env: only an scrypt hash
 * (`ADMIN_CODE_HASH`) lives in server-side environment variables.
 * Generate one with: `npm run admin:hash -- "<your code>"`.
 */

export const ADMIN_COOKIE = "mm_admin";
const SESSION_HOURS = 8;

function secret(): Buffer {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new ApiError(503, "admin_not_configured", "Admin sessiyasi sozlanmagan (ADMIN_SESSION_SECRET).");
  }
  return Buffer.from(s, "utf8");
}

export function verifyAdminCode(code: string): boolean {
  const stored = process.env.ADMIN_CODE_HASH;
  if (!stored) throw new ApiError(503, "admin_not_configured", "Admin kodi sozlanmagan (ADMIN_CODE_HASH).");
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) throw new ApiError(503, "admin_not_configured", "ADMIN_CODE_HASH formati noto‘g‘ri.");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(code.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export function createAdminToken(now = Date.now()): { token: string; maxAge: number } {
  const maxAge = SESSION_HOURS * 3600;
  const payload = b64url(Buffer.from(JSON.stringify({ v: 1, iat: now, exp: now + maxAge * 1000, sid: randomBytes(9).toString("hex") })));
  return { token: `${payload}.${sign(payload)}`, maxAge };
}

export function verifyAdminToken(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  let expectedSig: string;
  try {
    expectedSig = sign(payload);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v: number; exp: number };
    return data.v === 1 && typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

/** Throws 401 unless the request carries a valid admin session cookie. */
export async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  if (!verifyAdminToken(jar.get(ADMIN_COOKIE)?.value)) {
    throw new ApiError(401, "admin_required", "Admin sessiyasi tugagan. Qayta kiring.");
  }
}
