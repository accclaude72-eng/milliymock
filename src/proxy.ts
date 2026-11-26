import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/server/admin-session";

/**
 * Guards admin pages. API routes under /api/admin enforce the same check themselves
 * (defence in depth — never rely on this proxy alone).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
  matcher: ["/admin", "/admin/:path*"],
};
