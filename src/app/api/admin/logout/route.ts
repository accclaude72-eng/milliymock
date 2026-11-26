import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/server/admin-session";
import { assertSameOrigin, ok, route } from "@/lib/server/http";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return ok({ loggedOut: true });
});
