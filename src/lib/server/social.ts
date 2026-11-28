import "server-only";
import { anonName, randomCode } from "@/lib/battle";
import { ApiError } from "./http";
import { must, sb } from "./supabase";

/** Public names: the display name the student chose (reyting settings), else an anonymous label. */
export async function displayNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map(ids.map((id) => [id, anonName(id)]));
  if (!ids.length) return out;
  const rows =
    must(
      await sb()
        .from("leaderboard_profiles")
        .select("user_id, display_name")
        .in("user_id", [...new Set(ids)]),
      "names",
    ) ?? [];
  for (const r of rows) if (r.display_name) out.set(r.user_id as string, r.display_name as string);
  return out;
}

export const displayName = async (uid: string) => (await displayNames([uid])).get(uid)!;

/** The student's friend code (created on first use). */
export async function friendCode(uid: string): Promise<string> {
  const have = must(await sb().from("friend_codes").select("code").eq("user_id", uid).maybeSingle(), "friend code");
  if (have) return have.code as string;
  for (let i = 0; i < 5; i++) {
    const code = randomCode(8);
    const { error } = await sb().from("friend_codes").insert({ user_id: uid, code });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(`friend code: ${error.message}`);
    // Lost a race for our own row → read it; otherwise the code was taken → try another.
    const again = must(await sb().from("friend_codes").select("code").eq("user_id", uid).maybeSingle(), "friend code");
    if (again) return again.code as string;
  }
  throw new ApiError(500, "code", "Kod yaratib bo‘lmadi. Qayta urinib ko‘ring.");
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
  responded_at: string | null;
}

export async function friendships(uid: string): Promise<FriendshipRow[]> {
  return (must(await sb().from("friendships").select("*").or(`requester_id.eq.${uid},addressee_id.eq.${uid}`).order("created_at", { ascending: false }).limit(500), "friendships") ??
    []) as FriendshipRow[];
}

export const otherSide = (f: FriendshipRow, uid: string) => (f.requester_id === uid ? f.addressee_id : f.requester_id);

export async function friendIds(uid: string): Promise<string[]> {
  return (await friendships(uid)).filter((f) => f.status === "accepted").map((f) => otherSide(f, uid));
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const r = must(
    await sb().from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${x},addressee_id.eq.${y}),and(requester_id.eq.${y},addressee_id.eq.${x})`).maybeSingle(),
    "are friends",
  );
  return !!r;
}

/** Sends a request by friend code. If the other side already asked, it is accepted instead. */
export async function requestFriend(uid: string, code: string): Promise<{ status: "pending" | "accepted" }> {
  const target = must(await sb().from("friend_codes").select("user_id").eq("code", code.toUpperCase()).maybeSingle(), "find code");
  if (!target) throw new ApiError(404, "not_found", "Bu kod bo‘yicha nomzod topilmadi.");
  const other = target.user_id as string;
  if (other === uid) throw new ApiError(400, "self", "Bu sizning o‘z kodingiz.");
  const existing = (await friendships(uid)).find((f) => otherSide(f, uid) === other);
  if (existing) {
    if (existing.status === "accepted") throw new ApiError(409, "already", "Siz allaqachon do‘stsiz.");
    if (existing.status === "blocked") throw new ApiError(404, "not_found", "Bu kod bo‘yicha nomzod topilmadi.");
    if (existing.status === "pending" && existing.requester_id === uid) throw new ApiError(409, "sent", "So‘rov allaqachon yuborilgan.");
    if (existing.status === "pending") {
      await respond(uid, existing.id, "accept");
      return { status: "accepted" };
    }
    // Declined earlier → a new request replaces it.
    must(
      await sb()
        .from("friendships")
        .update({
          requester_id: uid,
          addressee_id: other,
          status: "pending",
          created_at: new Date().toISOString(),
          responded_at: null,
        })
        .eq("id", existing.id),
      "re-request",
    );
    return { status: "pending" };
  }
  const { error } = await sb().from("friendships").insert({ requester_id: uid, addressee_id: other });
  if (error?.code === "23505") throw new ApiError(409, "sent", "So‘rov allaqachon mavjud.");
  if (error) throw new Error(`friend request: ${error.message}`);
  return { status: "pending" };
}

/** accept / decline (addressee only), remove (either side), block (either side). */
export async function respond(uid: string, id: string, action: "accept" | "decline" | "remove" | "block"): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "So‘rov topilmadi.");
  const f = must(await sb().from("friendships").select("*").eq("id", id).maybeSingle(), "friendship") as FriendshipRow | null;
  if (!f || (f.requester_id !== uid && f.addressee_id !== uid)) throw new ApiError(404, "not_found", "So‘rov topilmadi.");
  const now = new Date().toISOString();
  if (action === "accept" || action === "decline") {
    if (f.addressee_id !== uid || f.status !== "pending") throw new ApiError(409, "state", "Bu so‘rovga javob berib bo‘lmaydi.");
    must(
      await sb()
        .from("friendships")
        .update({
          status: action === "accept" ? "accepted" : "declined",
          responded_at: now,
        })
        .eq("id", id)
        .eq("status", "pending"),
      "respond",
    );
  } else if (action === "remove") {
    // A block can only be lifted by the one who blocked.
    if (f.status === "blocked" && f.requester_id !== uid) throw new ApiError(404, "not_found", "So‘rov topilmadi.");
    must(await sb().from("friendships").update({ status: "declined", responded_at: now }).eq("id", id), "remove friend");
  } else {
    // The blocker becomes the requester, so only they see it as "blocked by me".
    must(
      await sb()
        .from("friendships")
        .update({
          status: "blocked",
          requester_id: uid,
          addressee_id: otherSide(f, uid),
          responded_at: now,
        })
        .eq("id", id),
      "block",
    );
  }
}
