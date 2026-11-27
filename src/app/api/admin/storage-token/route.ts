import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/server/admin-session";
import { ok, route } from "@/lib/server/http";
import { uploadUrl } from "@/lib/server/storage";
import { BUCKET } from "@/lib/server/supabase";

/**
 * Issues a one-time signed upload URL into the private `booklets` bucket, so the admin
 * browser can upload large HTML booklets straight to Supabase Storage.
 */
export const GET = route(async () => {
  await requireAdmin();
  const path = `materials/${randomUUID().replace(/-/g, "")}/booklet.html`;
  return ok({ bucket: BUCKET.booklets, ...(await uploadUrl(BUCKET.booklets, path)) });
});
