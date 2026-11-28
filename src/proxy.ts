import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/server/admin-session";

/** Session cookie: the intro is shown once per browser session (when the site is opened). */
export const INTRO_COOKIE = "mm_intro";
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|telegrambot|whatsapp|preview|lighthouse/i;

/**
 * 1) Opening the site ("/") starts with the animated intro — once per browser session.
 *    Search engines, link previews and Next.js prefetches are never redirected.
 * 2) Guards admin pages. API routes under /api/admin enforce the same check themselves
 *    (defence in depth — never rely on this proxy alone).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    const isPrefetch = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch" || req.headers.has("rsc") || req.nextUrl.searchParams.has("_rsc");
    const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
    if (req.cookies.has(INTRO_COOKIE) || isPrefetch || !wantsHtml || BOT.test(req.headers.get("user-agent") ?? "")) return NextResponse.next();
    const res = NextResponse.redirect(new URL("/intro", req.url));
    res.cookies.set(INTRO_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
    return res;
  }

  const valid = verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (pathname === "/admin/kirish") {
    if (valid) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }
  if (!valid) {
    const url = new URL("/admin/kirish", req.url);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*"],
};
