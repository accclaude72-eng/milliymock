import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

/** Battle statistics, study rooms and the latest room messages for moderation. */
export const GET = route(async () => {
  await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [battles, rooms, members, messages, friends] = await Promise.all([
    sb().from("battles").select("status, mode").gte("created_at", weekAgo).limit(5000),
    sb()
      .from("study_rooms")
      .select("id, name, subject_code, owner_id, status, created_at, max_members")
      .in("status", ["active", "hidden_by_admin"])
      .order("created_at", { ascending: false })
      .limit(200),
    sb().from("study_room_members").select("room_id, user_id, display_name, role"),
    sb().from("study_room_messages").select("id, room_id, display_name, body, created_at, deleted").order("id", { ascending: false }).limit(100),
    sb().from("friendships").select("id", { count: "exact", head: true }).eq("status", "accepted"),
  ]);
  const b = (must(battles, "admin battles") ?? []) as {
    status: string;
    mode: string;
  }[];
  const ms = (must(members, "admin members") ?? []) as {
    room_id: string;
    display_name: string;
    role: string;
  }[];
  const rs = (must(rooms, "admin rooms") ?? []) as {
    id: string;
    name: string;
    subject_code: string | null;
    status: string;
    created_at: string;
    max_members: number;
  }[];
  const names = new Map(rs.map((r) => [r.id, r.name]));
  return ok({
    battles: {
      week: b.length,
      finished: b.filter((x) => x.status === "finished").length,
      byMode: {
        random: b.filter((x) => x.mode === "random").length,
        friend: b.filter((x) => x.mode === "friend").length,
        code: b.filter((x) => x.mode === "code").length,
      },
    },
    friendships: friends.count ?? 0,
    rooms: rs.map((r) => ({
      id: r.id,
      name: r.name,
      subjectCode: r.subject_code,
      status: r.status,
      createdAt: r.created_at,
      members: ms.filter((m) => m.room_id === r.id).length,
      maxMembers: r.max_members,
      owner: ms.find((m) => m.room_id === r.id && m.role === "owner")?.display_name ?? "—",
    })),
    messages: (
      (must(messages, "admin messages") ?? []) as {
        id: number;
        room_id: string;
        display_name: string;
        body: string;
        created_at: string;
        deleted: boolean;
      }[]
    ).map((m) => ({
      id: Number(m.id),
      room: names.get(m.room_id) ?? "—",
      name: m.display_name,
      body: m.body,
      at: m.created_at,
      deleted: m.deleted,
    })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["hide_room", "restore_room"]),
    roomId: z.string().uuid(),
  }),
  z.object({
    action: z.enum(["hide_message", "restore_message"]),
    messageId: z.number().int().positive(),
  }),
]);

export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Body.parse(await readJson(req));
  if ("roomId" in b) {
    const r = must(
      await sb()
        .from("study_rooms")
        .update({
          status: b.action === "hide_room" ? "hidden_by_admin" : "active",
        })
        .eq("id", b.roomId)
        .neq("status", "closed")
        .select("id")
        .maybeSingle(),
      "room status",
    );
    if (!r) throw new ApiError(404, "not_found", "Xona topilmadi.");
    await audit(`room.${b.action === "hide_room" ? "hidden" : "restored"}`, `rooms/${b.roomId}`, {});
  } else {
    const r = must(
      await sb()
        .from("study_room_messages")
        .update({ deleted: b.action === "hide_message" })
        .eq("id", b.messageId)
        .select("id")
        .maybeSingle(),
      "message status",
    );
    if (!r) throw new ApiError(404, "not_found", "Xabar topilmadi.");
    await audit(`room.message_${b.action === "hide_message" ? "hidden" : "restored"}`, `messages/${b.messageId}`, {});
  }
  return ok({ done: true });
});
