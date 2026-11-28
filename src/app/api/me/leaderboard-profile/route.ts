import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

const Body = z.object({
  isPublic: z.boolean(),
  displayName: z
    .string()
    .trim()
    .min(2, "kamida 2 ta belgi")
    .max(40)
    .regex(/^[\p{L}\p{N} .'‘’ʼ_-]+$/u, "faqat harf, raqam va oddiy belgilar"),
});

/** Opt in / out of the public leaderboard and choose the display name. */
export const PUT = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`lbprofile:${user.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p o‘zgartirish. Birozdan so‘ng urinib ko‘ring.");
  const b = Body.parse(await readJson(req));
  must(
    await sb()
      .from("leaderboard_profiles")
      .upsert({ user_id: user.uid, is_public: b.isPublic, display_name: b.displayName, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
    "lb profile",
  );
  return ok(b);
});
