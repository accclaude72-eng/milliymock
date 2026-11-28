import { z } from "zod";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { sinceOf } from "@/lib/server/leaderboard";
import { rateLimit } from "@/lib/server/repo";
import { displayNames, friendCode, friendships, otherSide, requestFriend, respond } from "@/lib/server/social";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Friend code, friends with this week's XP (friends leaderboard), requests in both directions. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  const uid = user.uid;
  const [code, fs, prof] = await Promise.all([friendCode(uid), friendships(uid), sb().from("leaderboard_profiles").select("display_name, is_public").eq("user_id", uid).maybeSingle()]);
  const others = fs.map((f) => otherSide(f, uid));
  const names = await displayNames([uid, ...others]);
  const accepted = fs.filter((f) => f.status === "accepted");
  const board = [uid, ...accepted.map((f) => otherSide(f, uid))];
  const xpRows = must(await sb().from("xp_ledger").select("user_id, amount").in("user_id", board).gte("created_at", sinceOf("week")), "friends xp") ?? [];
  const xp = new Map<string, number>();
  for (const r of xpRows) xp.set(r.user_id as string, (xp.get(r.user_id as string) ?? 0) + Number(r.amount));
  const p = must(prof, "my lb profile");
  return ok({
    code,
    myName: names.get(uid),
    nameSet: !!p?.display_name,
    isPublic: !!p?.is_public,
    board: board
      .map((id) => ({
        id,
        name: names.get(id)!,
        xp: xp.get(id) ?? 0,
        me: id === uid,
        friendshipId: accepted.find((f) => otherSide(f, uid) === id)?.id ?? null,
      }))
      .sort((a, b) => b.xp - a.xp)
      .map((r, i) => ({ ...r, rank: i + 1 })),
    incoming: fs
      .filter((f) => f.status === "pending" && f.addressee_id === uid)
      .map((f) => ({
        id: f.id,
        name: names.get(f.requester_id)!,
        at: f.created_at,
      })),
    outgoing: fs
      .filter((f) => f.status === "pending" && f.requester_id === uid)
      .map((f) => ({
        id: f.id,
        name: names.get(f.addressee_id)!,
        at: f.created_at,
      })),
    blocked: fs.filter((f) => f.status === "blocked" && f.requester_id === uid).map((f) => ({ id: f.id, name: names.get(f.addressee_id)! })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{6,10}$/, "Kod 6–10 ta harf/raqamdan iborat"),
  }),
  z.object({
    action: z.enum(["accept", "decline", "remove", "block"]),
    id: z.string().uuid(),
  }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  const b = Body.parse(await readJson(req));
  if (b.action === "request") {
    // Limits guessing other students' codes.
    if (!(await rateLimit(`friendreq:${user.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.");
    return ok(await requestFriend(user.uid, b.code));
  }
  await respond(user.uid, b.id, b.action);
  return ok({ done: true });
});
