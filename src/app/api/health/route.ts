import { firebaseConfigured, usingEmulators } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";

export const GET = route(async () => {
  return ok({
    firebase: firebaseConfigured(),
    emulators: usingEmulators(),
    admin: !!process.env.ADMIN_CODE_HASH && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32,
    serverNow: Date.now(),
  });
});
