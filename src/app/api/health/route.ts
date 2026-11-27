import { ok, route } from "@/lib/server/http";
import { supabaseConfigured } from "@/lib/server/supabase";

export const GET = route(async () => {
  return ok({
    supabase: supabaseConfigured(),
    supabaseBrowser: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    admin: !!process.env.ADMIN_CODE_HASH && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32,
    serverNow: Date.now(),
  });
});
