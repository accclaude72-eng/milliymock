import "server-only";
import { ONLINE_MS, ROOM_TIMER_MIN, randomCode } from "@/lib/battle";
import { ApiError } from "./http";
import { displayName } from "./social";
import { must, sb } from "./supabase";

export interface RoomRow {
  id: string;
  name: string;
  subject_code: string | null;
  description: string | null;
  owner_id: string;
  invite_code: string;
  max_members: number;
  timer_mode: "focus" | "break" | null;
  timer_ends_at: string | null;
  status: "active" | "closed" | "hidden_by_admin";
  created_at: string;
}

export interface MemberRow {
  room_id: string;
  user_id: string;
  role: "owner" | "member";
  display_name: string;
  joined_at: string;
  last_seen_at: string;
  muted: boolean;
}

const MAX_OWNED = 5;
const MAX_JOINED = 20;

export async function getRoom(id: string): Promise<RoomRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Xona topilmadi.");
  const r = must(await sb().from("study_rooms").select("*").eq("id", id).maybeSingle(), "room") as RoomRow | null;
  if (!r || r.status !== "active") throw new ApiError(404, "not_found", "Xona topilmadi yoki yopilgan.");
  return r;
}

async function members(roomId: string): Promise<MemberRow[]> {
  return (must(await sb().from("study_room_members").select("*").eq("room_id", roomId).order("joined_at"), "room members") ?? []) as MemberRow[];
}

export async function membership(uid: string, roomId: string): Promise<MemberRow> {
  const m = must(await sb().from("study_room_members").select("*").eq("room_id", roomId).eq("user_id", uid).maybeSingle(), "membership") as MemberRow | null;
  if (!m) throw new ApiError(404, "not_found", "Xona topilmadi.");
  return m;
}

export async function createRoom(
  uid: string,
  input: {
    name: string;
    subjectCode: string | null;
    description: string | null;
    maxMembers: number;
  },
): Promise<string> {
  const owned = must(await sb().from("study_rooms").select("id").eq("owner_id", uid).eq("status", "active"), "owned rooms") ?? [];
  if (owned.length >= MAX_OWNED) throw new ApiError(409, "limit", `Ko‘pi bilan ${MAX_OWNED} ta xona ochish mumkin. Keraksizini yoping.`);
  for (let i = 0; i < 4; i++) {
    const { data, error } = await sb()
      .from("study_rooms")
      .insert({
        name: input.name,
        subject_code: input.subjectCode,
        description: input.description,
        owner_id: uid,
        invite_code: randomCode(8),
        max_members: input.maxMembers,
      })
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    const id = (must({ data, error }, "create room") as { id: string }).id;
    must(
      await sb()
        .from("study_room_members")
        .insert({
          room_id: id,
          user_id: uid,
          role: "owner",
          display_name: await displayName(uid),
        }),
      "room owner",
    );
    return id;
  }
  throw new ApiError(500, "code", "Xona yaratib bo‘lmadi. Qayta urinib ko‘ring.");
}

export async function joinRoom(uid: string, code: string): Promise<string> {
  const r = must(await sb().from("study_rooms").select("*").eq("invite_code", code.toUpperCase()).maybeSingle(), "room by code") as RoomRow | null;
  if (!r || r.status !== "active") throw new ApiError(404, "not_found", "Bu kod bo‘yicha xona topilmadi.");
  const ms = await members(r.id);
  if (ms.some((m) => m.user_id === uid)) return r.id;
  if (ms.length >= r.max_members) throw new ApiError(409, "full", "Xona to‘lgan.");
  const joined = must(await sb().from("study_room_members").select("room_id").eq("user_id", uid), "joined rooms") ?? [];
  if (joined.length >= MAX_JOINED) throw new ApiError(409, "limit", `Ko‘pi bilan ${MAX_JOINED} ta xonada bo‘lish mumkin.`);
  const { error } = await sb()
    .from("study_room_members")
    .insert({
      room_id: r.id,
      user_id: uid,
      display_name: await displayName(uid),
    });
  if (error && error.code !== "23505") throw new Error(`join room: ${error.message}`);
  return r.id;
}

/** Leaving: the owner hands the room to the longest-standing member; the last one out closes it. */
export async function leaveRoom(uid: string, r: RoomRow): Promise<void> {
  must(await sb().from("study_room_members").delete().eq("room_id", r.id).eq("user_id", uid), "leave room");
  if (r.owner_id !== uid) return;
  const rest = await members(r.id);
  if (!rest.length) {
    must(await sb().from("study_rooms").update({ status: "closed" }).eq("id", r.id), "close room");
    return;
  }
  must(await sb().from("study_rooms").update({ owner_id: rest[0].user_id }).eq("id", r.id), "new owner");
  must(await sb().from("study_room_members").update({ role: "owner" }).eq("room_id", r.id).eq("user_id", rest[0].user_id), "new owner role");
}

export async function myRooms(uid: string) {
  const mine = (must(await sb().from("study_room_members").select("room_id").eq("user_id", uid), "my rooms") ?? []).map((m) => m.room_id as string);
  if (!mine.length) return [];
  const [rooms, ms] = await Promise.all([
    sb().from("study_rooms").select("*").in("id", mine).eq("status", "active"),
    sb().from("study_room_members").select("room_id, last_seen_at").in("room_id", mine),
  ]);
  const all = (must(ms, "room counts") ?? []) as {
    room_id: string;
    last_seen_at: string;
  }[];
  const now = Date.now();
  return ((must(rooms, "rooms") ?? []) as RoomRow[])
    .map((r) => {
      const here = all.filter((m) => m.room_id === r.id);
      return {
        id: r.id,
        name: r.name,
        subjectCode: r.subject_code,
        description: r.description,
        isOwner: r.owner_id === uid,
        members: here.length,
        online: here.filter((m) => now - Date.parse(m.last_seen_at) < ONLINE_MS).length,
        maxMembers: r.max_members,
      };
    })
    .sort((a, b) => b.online - a.online || a.name.localeCompare(b.name));
}

/** The room as a member sees it. Also the heartbeat: marks the caller as online. */
export async function roomView(uid: string, r: RoomRow, afterId = 0) {
  const me = await membership(uid, r.id);
  // Heartbeat, at most every 20 s (fewer writes; reloads don't trigger more writes).
  if (Date.now() - Date.parse(me.last_seen_at) > 20_000) await sb().from("study_room_members").update({ last_seen_at: new Date().toISOString() }).eq("room_id", r.id).eq("user_id", uid);
  let mq = sb().from("study_room_messages").select("id, user_id, display_name, body, created_at").eq("room_id", r.id).eq("deleted", false).order("id", { ascending: false }).limit(60);
  if (afterId > 0) mq = mq.gt("id", afterId);
  const [ms, msgs] = await Promise.all([members(r.id), mq]);
  const now = Date.now();
  return {
    id: r.id,
    name: r.name,
    subjectCode: r.subject_code,
    description: r.description,
    inviteCode: r.invite_code,
    maxMembers: r.max_members,
    isOwner: r.owner_id === uid,
    muted: me.muted,
    me: uid,
    serverNow: now,
    timer: r.timer_mode && r.timer_ends_at && Date.parse(r.timer_ends_at) > now ? { mode: r.timer_mode, endsAt: Date.parse(r.timer_ends_at) } : null,
    members: ms.map((m) => ({
      id: m.user_id,
      name: m.display_name,
      role: m.role,
      muted: m.muted,
      online: m.user_id === uid || now - Date.parse(m.last_seen_at) < ONLINE_MS,
    })),
    messages: (
      (must(msgs, "messages") ?? []) as {
        id: number;
        user_id: string;
        display_name: string;
        body: string;
        created_at: string;
      }[]
    )
      .reverse()
      .map((m) => ({
        id: Number(m.id),
        userId: m.user_id,
        name: m.display_name,
        body: m.body,
        at: Date.parse(m.created_at),
      })),
  };
}

export async function postMessage(uid: string, r: RoomRow, body: string): Promise<void> {
  const me = await membership(uid, r.id);
  if (me.muted) throw new ApiError(403, "muted", "Xona egasi sizga yozishni vaqtincha cheklagan.");
  must(
    await sb().from("study_room_messages").insert({
      room_id: r.id,
      user_id: uid,
      display_name: me.display_name,
      body,
    }),
    "post message",
  );
}

/** Owner-only controls. */
export async function ownerAction(
  uid: string,
  r: RoomRow,
  action: { kind: "timer"; mode: "focus" | "break" | "stop" } | { kind: "kick" | "mute" | "unmute"; userId: string } | { kind: "delete_message"; messageId: number },
): Promise<void> {
  if (r.owner_id !== uid) throw new ApiError(403, "forbidden", "Bu amal faqat xona egasi uchun.");
  if (action.kind === "timer") {
    const ends = action.mode === "stop" ? null : new Date(Date.now() + ROOM_TIMER_MIN[action.mode] * 60_000).toISOString();
    must(
      await sb()
        .from("study_rooms")
        .update({
          timer_mode: action.mode === "stop" ? null : action.mode,
          timer_ends_at: ends,
        })
        .eq("id", r.id),
      "room timer",
    );
    return;
  }
  if (action.kind === "delete_message") {
    must(await sb().from("study_room_messages").update({ deleted: true }).eq("id", action.messageId).eq("room_id", r.id), "delete message");
    return;
  }
  if (action.userId === uid) throw new ApiError(400, "self", "Bu amalni o‘zingizga qo‘llab bo‘lmaydi.");
  await membership(action.userId, r.id);
  if (action.kind === "kick") must(await sb().from("study_room_members").delete().eq("room_id", r.id).eq("user_id", action.userId), "kick");
  else
    must(
      await sb()
        .from("study_room_members")
        .update({ muted: action.kind === "mute" })
        .eq("room_id", r.id)
        .eq("user_id", action.userId),
      "mute",
    );
}
