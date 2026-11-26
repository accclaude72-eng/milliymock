import { requireAdmin } from "@/lib/server/admin-session";
import { adminAuth } from "@/lib/server/firebase-admin";
import { ok, route } from "@/lib/server/http";

const ADMIN_STORAGE_UID = "milliy-mock-admin-uploader";

/**
 * Issues a Firebase custom token (claim admin=true) so the admin browser can upload
 * large HTML booklets straight to Firebase Storage. Storage rules only allow writes
 * under materials/ for tokens carrying this claim.
 */
export const GET = route(async () => {
  await requireAdmin();
  const token = await adminAuth().createCustomToken(ADMIN_STORAGE_UID, { admin: true });
  return ok({ token });
});
