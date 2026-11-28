import "server-only";
import { ApiError } from "./http";
import { bankRows, revealMap, toPublicQuestion } from "./question-bank";
import { displayName } from "./social";
import { must, sb } from "./supabase";

export const EDIT_WINDOW_MS = 30 * 60_000;
type Target = "thread" | "reply";

interface PostRow {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  status: "visible" | "hidden";
  created_at: string;
  edited_at: string | null;
}
interface ThreadRow extends PostRow {
  question_id: string;
}
interface ReplyRow extends PostRow {
  discussion_id: string;
}

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * Spoiler protection: a question's discussion opens only for students who have already
 * answered it (a graded mock / practice answer, or it is in their mistake notebook).
 */
export async function canDiscuss(uid: string, questionId: string): Promise<boolean> {
  const [ev, mis] = await Promise.all([
    sb().from("answer_events").select("question_id").eq("user_id", uid).eq("question_id", questionId).limit(1),
    sb().from("student_mistakes").select("question_id").eq("user_id", uid).eq("question_id", questionId).limit(1),
  ]);
  return !!(must(ev, "discuss events")?.length || must(mis, "discuss mistakes")?.length);
}

async function requireAccess(uid: string, questionId: string) {
  if (!/^[A-Za-z0-9_:-]{1,80}$/.test(questionId)) throw new ApiError(404, "not_found", "Savol topilmadi.");
  const q = (await bankRows([questionId])).get(questionId);
  if (!q || !q.active) throw new ApiError(404, "not_found", "Savol topilmadi.");
  if (!(await canDiscuss(uid, questionId))) throw new ApiError(403, "locked", "Muhokama savolga javob berganingizdan keyin ochiladi.");
  return q;
}

export async function discussionView(uid: string, questionId: string) {
  const q = await requireAccess(uid, questionId);
  const reveal = (await revealMap([q.material_id])).get(q.material_id);
  const threads = (must(await sb().from("discussions").select("*").eq("question_id", questionId).eq("status", "visible").order("created_at").limit(200), "threads") ?? []) as ThreadRow[];
  const tids = threads.map((t) => t.id);
  const replies = tids.length
    ? ((must(await sb().from("discussion_replies").select("*").in("discussion_id", tids).eq("status", "visible").order("created_at").limit(2000), "replies") ?? []) as ReplyRow[])
    : [];
  const allIds = [...tids, ...replies.map((r) => r.id)];
  const votes = allIds.length ? ((must(await sb().from("discussion_votes").select("user_id, target_id").in("target_id", allIds), "votes") ?? []) as { user_id: string; target_id: string }[]) : [];
  const count = (id: string) => votes.filter((v) => v.target_id === id).length;
  const mineVoted = (id: string) => votes.some((v) => v.target_id === id && v.user_id === uid);
  const now = Date.now();
  const post = (p: PostRow) => ({
    id: p.id,
    name: p.display_name,
    body: p.body,
    at: Date.parse(p.created_at),
    edited: !!p.edited_at,
    mine: p.user_id === uid,
    canEdit: p.user_id === uid && now - Date.parse(p.created_at) < EDIT_WINDOW_MS,
    votes: count(p.id),
    voted: mineVoted(p.id),
  });
  return {
    question: { ...toPublicQuestion(q), material: reveal?.title ?? "", correct: reveal?.reveal ? q.correct : null },
    threads: threads.map((t) => ({ ...post(t), replies: replies.filter((r) => r.discussion_id === t.id).map(post) })).sort((a, b) => b.votes - a.votes || a.at - b.at),
  };
}

export async function postThread(uid: string, questionId: string, body: string): Promise<string> {
  await requireAccess(uid, questionId);
  const r = must(
    await sb()
      .from("discussions")
      .insert({ question_id: questionId, user_id: uid, display_name: await displayName(uid), body })
      .select("id")
      .single(),
    "post thread",
  ) as { id: string };
  return r.id;
}

async function getPost(type: Target, id: string): Promise<(ThreadRow | ReplyRow) & { questionId: string }> {
  if (!isId(id)) throw new ApiError(404, "not_found", "Xabar topilmadi.");
  if (type === "thread") {
    const t = must(await sb().from("discussions").select("*").eq("id", id).maybeSingle(), "thread") as ThreadRow | null;
    if (!t) throw new ApiError(404, "not_found", "Xabar topilmadi.");
    return { ...t, questionId: t.question_id };
  }
  const r = must(await sb().from("discussion_replies").select("*, discussions(question_id, status)").eq("id", id).maybeSingle(), "reply") as
    (ReplyRow & { discussions: { question_id: string; status: string } | null }) | null;
  if (!r || !r.discussions) throw new ApiError(404, "not_found", "Xabar topilmadi.");
  return { ...r, questionId: r.discussions.question_id };
}

export async function postReply(uid: string, threadId: string, body: string): Promise<string> {
  const t = await getPost("thread", threadId);
  if (t.status !== "visible") throw new ApiError(404, "not_found", "Xabar topilmadi.");
  await requireAccess(uid, t.questionId);
  const r = must(
    await sb()
      .from("discussion_replies")
      .insert({ discussion_id: threadId, user_id: uid, display_name: await displayName(uid), body })
      .select("id")
      .single(),
    "post reply",
  ) as { id: string };
  return r.id;
}

const table = (t: Target) => (t === "thread" ? "discussions" : "discussion_replies");

export async function editOwn(uid: string, type: Target, id: string, body: string): Promise<void> {
  const p = await getPost(type, id);
  if (p.user_id !== uid || p.status !== "visible") throw new ApiError(404, "not_found", "Xabar topilmadi.");
  if (Date.now() - Date.parse(p.created_at) > EDIT_WINDOW_MS) throw new ApiError(409, "too_late", "Xabarni faqat yozilgandan keyin 30 daqiqa ichida tahrirlash mumkin.");
  must(await sb().from(table(type)).update({ body, edited_at: new Date().toISOString() }).eq("id", id), "edit post");
}

/** Authors remove their own post (hidden, not hard-deleted — moderation history stays). */
export async function removeOwn(uid: string, type: Target, id: string): Promise<void> {
  const p = await getPost(type, id);
  if (p.user_id !== uid) throw new ApiError(404, "not_found", "Xabar topilmadi.");
  must(await sb().from(table(type)).update({ status: "hidden" }).eq("id", id), "remove post");
}

export async function toggleVote(uid: string, type: Target, id: string): Promise<boolean> {
  const p = await getPost(type, id);
  if (p.status !== "visible") throw new ApiError(404, "not_found", "Xabar topilmadi.");
  await requireAccess(uid, p.questionId);
  if (p.user_id === uid) throw new ApiError(400, "self", "O‘z xabaringizga ovoz berib bo‘lmaydi.");
  const { data } = await sb().from("discussion_votes").delete().eq("user_id", uid).eq("target_type", type).eq("target_id", id).select("user_id");
  if (data?.length) return false;
  const { error } = await sb().from("discussion_votes").insert({ user_id: uid, target_type: type, target_id: id });
  if (error && error.code !== "23505") throw new Error(`vote: ${error.message}`);
  return true;
}

export async function report(uid: string, type: Target, id: string, reason: string, note: string | null): Promise<void> {
  const p = await getPost(type, id);
  await requireAccess(uid, p.questionId);
  if (p.user_id === uid) throw new ApiError(400, "self", "O‘z xabaringiz ustidan shikoyat qilib bo‘lmaydi.");
  const { error } = await sb().from("discussion_reports").insert({ target_type: type, target_id: id, reporter_id: uid, reason, note });
  if (error?.code === "23505") throw new ApiError(409, "already", "Siz bu xabar haqida allaqachon xabar bergansiz.");
  if (error) throw new Error(`report: ${error.message}`);
}

/* ----------------------------------------------------------------- admin */

export async function adminReports(status: "open" | "all") {
  let q = sb().from("discussion_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (status === "open") q = q.eq("status", "open");
  const reps = (must(await q, "reports") ?? []) as { id: string; target_type: Target; target_id: string; reason: string; note: string | null; status: string; created_at: string }[];
  const tIds = reps.filter((r) => r.target_type === "thread").map((r) => r.target_id);
  const rIds = reps.filter((r) => r.target_type === "reply").map((r) => r.target_id);
  const [threads, replies] = await Promise.all([
    tIds.length ? sb().from("discussions").select("id, display_name, body, status, question_id").in("id", tIds) : Promise.resolve({ data: [], error: null }),
    rIds.length ? sb().from("discussion_replies").select("id, display_name, body, status, discussions(question_id)").in("id", rIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const posts = new Map<string, { name: string; body: string; status: string; questionId: string }>();
  for (const t of (must(threads, "rep threads") ?? []) as { id: string; display_name: string; body: string; status: string; question_id: string }[])
    posts.set(t.id, { name: t.display_name, body: t.body, status: t.status, questionId: t.question_id });
  for (const r of (must(replies, "rep replies") ?? []) as unknown as { id: string; display_name: string; body: string; status: string; discussions: { question_id: string } | null }[])
    posts.set(r.id, { name: r.display_name, body: r.body, status: r.status, questionId: r.discussions?.question_id ?? "" });
  return reps.map((r) => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, note: r.note, status: r.status, at: r.created_at, post: posts.get(r.target_id) ?? null }));
}

export async function adminRecent() {
  const [t, r] = await Promise.all([
    sb().from("discussions").select("id, display_name, body, status, question_id, created_at").order("created_at", { ascending: false }).limit(50),
    sb().from("discussion_replies").select("id, display_name, body, status, created_at, discussions(question_id)").order("created_at", { ascending: false }).limit(50),
  ]);
  const threads = ((must(t, "recent threads") ?? []) as { id: string; display_name: string; body: string; status: string; question_id: string; created_at: string }[]).map((x) => ({
    type: "thread" as const,
    id: x.id,
    name: x.display_name,
    body: x.body,
    status: x.status,
    questionId: x.question_id,
    at: x.created_at,
  }));
  const replies = (
    (must(r, "recent replies") ?? []) as unknown as { id: string; display_name: string; body: string; status: string; created_at: string; discussions: { question_id: string } | null }[]
  ).map((x) => ({
    type: "reply" as const,
    id: x.id,
    name: x.display_name,
    body: x.body,
    status: x.status,
    questionId: x.discussions?.question_id ?? "",
    at: x.created_at,
  }));
  return [...threads, ...replies].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
}

export async function setPostStatus(type: Target, id: string, status: "visible" | "hidden"): Promise<void> {
  await getPost(type, id);
  must(await sb().from(table(type)).update({ status }).eq("id", id), "post status");
  // Hiding or restoring settles the open reports about that post.
  must(await sb().from("discussion_reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("target_type", type).eq("target_id", id).eq("status", "open"), "resolve reports");
}

export async function dismissReport(id: string): Promise<void> {
  if (!isId(id)) throw new ApiError(404, "not_found", "Shikoyat topilmadi.");
  const r = must(await sb().from("discussion_reports").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle(), "dismiss");
  if (!r) throw new ApiError(404, "not_found", "Shikoyat topilmadi.");
}
