import "server-only";
import { BATTLE_COUNT, BATTLE_GRACE_MS, BATTLE_LEAD_MS, BATTLE_SEC_PER_Q, BATTLE_WAIT_MS, RANDOM_MATCH_MS, type SideResult, battleXp, decideWinner, optionOrder, randomCode } from "@/lib/battle";
import { DISPLAY } from "@/lib/gamify";
import { challengePool, pickQuestions } from "./challenges";
import { grantXp, refreshAchievements } from "./gamification";
import { ApiError } from "./http";
import { bankRows, gradeBankAnswer } from "./question-bank";
import { areFriends, displayName } from "./social";
import { must, sb } from "./supabase";

export interface BattleRow {
  id: string;
  mode: "random" | "friend" | "code";
  subject_code: string;
  status: "waiting" | "active" | "finished" | "cancelled" | "expired";
  invite_code: string | null;
  created_by: string;
  invited_user: string | null;
  question_count: number;
  sec_per_question: number;
  created_at: string;
  started_at: string | null;
  deadline_at: string | null;
  finished_at: string | null;
  winner_id: string | null;
}

export interface ParticipantRow {
  battle_id: string;
  user_id: string;
  display_name: string;
  answered: number;
  correct: number | null;
  duration_ms: number | null;
  finished_at: string | null;
  joined_at: string;
}

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function getBattle(id: string): Promise<BattleRow> {
  if (!isId(id)) throw new ApiError(404, "not_found", "Battle topilmadi.");
  const b = must(await sb().from("battles").select("*").eq("id", id).maybeSingle(), "battle") as BattleRow | null;
  if (!b) throw new ApiError(404, "not_found", "Battle topilmadi.");
  return b;
}

async function participants(battleId: string): Promise<ParticipantRow[]> {
  return (must(await sb().from("battle_participants").select("*").eq("battle_id", battleId).order("joined_at"), "participants") ?? []) as ParticipantRow[];
}

async function questionIds(battleId: string): Promise<string[]> {
  const rows = must(await sb().from("battle_questions").select("question_id, position").eq("battle_id", battleId).order("position"), "battle questions") ?? [];
  return rows.map((r) => r.question_id as string);
}

/** Closes the student's own lobbies that nobody joined, so they never wait in two battles at once. */
async function cancelMyWaiting(uid: string): Promise<void> {
  must(await sb().from("battles").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("created_by", uid).eq("status", "waiting"), "cancel waiting");
}

async function addParticipant(battleId: string, uid: string): Promise<void> {
  const { error } = await sb()
    .from("battle_participants")
    .insert({
      battle_id: battleId,
      user_id: uid,
      display_name: await displayName(uid),
    });
  if (error && error.code !== "23505") throw new Error(`join battle: ${error.message}`);
}

/** The second player joins: waiting → active (conditional, so only one can take the free seat). */
async function takeSeat(b: BattleRow, uid: string): Promise<boolean> {
  const start = Date.now() + BATTLE_LEAD_MS;
  const upd = must(
    await sb()
      .from("battles")
      .update({
        status: "active",
        started_at: new Date(start).toISOString(),
        deadline_at: new Date(start + b.question_count * b.sec_per_question * 1000).toISOString(),
      })
      .eq("id", b.id)
      .eq("status", "waiting")
      .select("id"),
    "take seat",
  );
  if (!upd?.length) return false;
  await addParticipant(b.id, uid);
  return true;
}

export interface CreateInput {
  mode: "random" | "friend" | "code";
  subject: string;
  friendId?: string;
}

/** Random: joins a fresh open lobby of the same subject, or opens one. Friend / code: always a new lobby. */
export async function createBattle(uid: string, input: CreateInput): Promise<{ id: string; matched: boolean }> {
  await cancelMyWaiting(uid);
  if (input.mode === "random") {
    const since = new Date(Date.now() - RANDOM_MATCH_MS).toISOString();
    const open = (must(
      await sb()
        .from("battles")
        .select("*")
        .eq("mode", "random")
        .eq("status", "waiting")
        .eq("subject_code", input.subject)
        .neq("created_by", uid)
        .gte("created_at", since)
        .order("created_at")
        .limit(5),
      "open lobbies",
    ) ?? []) as BattleRow[];
    for (const b of open) if (await takeSeat(b, uid)) return { id: b.id, matched: true };
  }
  if (input.mode === "friend") {
    if (!input.friendId || !isId(input.friendId) || !(await areFriends(uid, input.friendId))) throw new ApiError(403, "not_friend", "Faqat do‘stingizni battle’ga chaqira olasiz.");
  }
  const pool = await challengePool(input.subject === "mixed" ? null : input.subject);
  const ids = pickQuestions(pool, BATTLE_COUNT, `battle:${uid}:${Date.now()}:${Math.random()}`);
  if (ids.length < 3) throw new ApiError(409, "no_questions", "Bu fan bo‘yicha battle uchun savollar hali yetarli emas.");

  for (let i = 0; i < 4; i++) {
    const { data, error } = await sb()
      .from("battles")
      .insert({
        mode: input.mode,
        subject_code: input.subject,
        created_by: uid,
        invited_user: input.mode === "friend" ? input.friendId : null,
        invite_code: input.mode === "code" ? randomCode(6) : null,
        question_count: ids.length,
        sec_per_question: BATTLE_SEC_PER_Q,
      })
      .select("*")
      .single();
    if (error?.code === "23505") continue; // invite code collision → another code
    const b = must({ data, error }, "create battle") as BattleRow;
    must(
      await sb()
        .from("battle_questions")
        .insert(ids.map((q, k) => ({ battle_id: b.id, position: k, question_id: q }))),
      "battle questions",
    );
    await addParticipant(b.id, uid);
    return { id: b.id, matched: false };
  }
  throw new ApiError(500, "code", "Battle yaratib bo‘lmadi. Qayta urinib ko‘ring.");
}

/** Joins by invite code (code battles) or by id (the invited friend). */
export async function joinBattle(uid: string, ref: { code?: string; id?: string }): Promise<string> {
  let b: BattleRow | null;
  if (ref.code) {
    b = must(await sb().from("battles").select("*").eq("invite_code", ref.code.toUpperCase()).maybeSingle(), "battle by code") as BattleRow | null;
    if (!b) throw new ApiError(404, "not_found", "Bu kod bo‘yicha battle topilmadi.");
  } else b = await getBattle(ref.id ?? "");
  b = await settle(b);
  if (b.created_by === uid) return b.id;
  const mine = (await participants(b.id)).some((p) => p.user_id === uid);
  if (mine) return b.id;
  if (b.status !== "waiting") throw new ApiError(409, "closed", "Bu battle’ga qo‘shilib bo‘lmaydi — u boshlangan yoki yopilgan.");
  if (b.mode === "friend" && b.invited_user !== uid) throw new ApiError(403, "not_invited", "Bu battle boshqa nomzod uchun.");
  if (b.mode === "random") throw new ApiError(403, "random", "Tasodifiy battle’ga faqat navbat orqali qo‘shiladi.");
  await cancelMyWaiting(uid);
  if (!(await takeSeat(b, uid))) throw new ApiError(409, "taken", "Kimdir sizdan oldin qo‘shildi.");
  return b.id;
}

export async function cancelBattle(uid: string, b: BattleRow): Promise<void> {
  const isInvited = b.mode === "friend" && b.invited_user === uid;
  if (b.created_by !== uid && !isInvited) throw new ApiError(403, "forbidden", "Bu battle’ni bekor qila olmaysiz.");
  const upd = must(await sb().from("battles").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", b.id).eq("status", "waiting").select("id"), "cancel battle");
  if (!upd?.length) throw new ApiError(409, "state", "Battle allaqachon boshlangan yoki yopilgan.");
}

/** Lazy state changes: a stale lobby expires; a battle past its deadline is finished. */
export async function settle(b: BattleRow): Promise<BattleRow> {
  if (b.status === "waiting" && Date.parse(b.created_at) + BATTLE_WAIT_MS < Date.now()) {
    must(await sb().from("battles").update({ status: "expired", finished_at: new Date().toISOString() }).eq("id", b.id).eq("status", "waiting"), "expire battle");
    return getBattle(b.id);
  }
  if (b.status === "active" && b.deadline_at && Date.parse(b.deadline_at) + BATTLE_GRACE_MS < Date.now()) {
    await finalize(b);
    return getBattle(b.id);
  }
  return b;
}

async function sideResults(b: BattleRow, ps: ParticipantRow[]): Promise<SideResult[]> {
  const rows = must(await sb().from("battle_answers").select("user_id, answer, is_correct, answered_ms").eq("battle_id", b.id), "battle answers") ?? [];
  return ps.map((p) => {
    const mine = rows.filter((r) => r.user_id === p.user_id);
    // "answered" = an option was actually picked (skipped / timed-out questions don't count toward XP).
    return {
      userId: p.user_id,
      correct: mine.filter((r) => r.is_correct).length,
      answered: mine.filter((r) => r.answer).length,
      lastMs: mine.reduce((m, r) => Math.max(m, Number(r.answered_ms)), 0),
    };
  });
}

/** Scores the battle once (conditional status change), then grants XP. */
async function finalize(b: BattleRow): Promise<void> {
  const ps = await participants(b.id);
  const sides = await sideResults(b, ps);
  const winner = sides.length === 2 ? decideWinner(sides[0], sides[1]) : null;
  const upd = must(
    await sb()
      .from("battles")
      .update({
        status: "finished",
        finished_at: new Date().toISOString(),
        winner_id: winner,
      })
      .eq("id", b.id)
      .eq("status", "active")
      .select("id"),
    "finish battle",
  );
  if (!upd?.length) return; // somebody else finished it
  for (const s of sides) {
    must(await sb().from("battle_participants").update({ correct: s.correct, duration_ms: s.lastMs }).eq("battle_id", b.id).eq("user_id", s.userId), "battle score");
    const xp = battleXp(s, winner, b.question_count);
    const subject = b.subject_code === "mixed" ? null : b.subject_code;
    if (xp > 0) await grantXp(s.userId, xp, "battle", b.id, subject);
    await refreshAchievements(s.userId).catch(() => undefined);
  }
}

/** Records one answer (questions are answered in order, each once). */
export async function answer(uid: string, b: BattleRow, position: number, letter: string | null): Promise<{ ok: boolean; done: boolean }> {
  b = await settle(b);
  if (b.status !== "active" || !b.started_at || !b.deadline_at) throw new ApiError(409, "state", "Battle faol emas.");
  const now = Date.now();
  if (now < Date.parse(b.started_at)) throw new ApiError(409, "early", "Battle hali boshlanmadi.");
  if (now > Date.parse(b.deadline_at) + BATTLE_GRACE_MS) throw new ApiError(409, "time_up", "Vaqt tugadi.");
  // Independent reads in parallel (each Supabase round trip costs latency).
  const [ps, qrow] = await Promise.all([participants(b.id), sb().from("battle_questions").select("question_id").eq("battle_id", b.id).eq("position", position).maybeSingle()]);
  const me = ps.find((p) => p.user_id === uid);
  if (!me) throw new ApiError(404, "not_found", "Battle topilmadi.");
  if (position !== me.answered) throw new ApiError(409, "order", "Savollar ketma-ket javoblanadi. Sahifani yangilang.");
  const qid = must(qrow, "battle question")?.question_id as string | undefined;
  if (!qid) throw new ApiError(400, "position", "Bunday savol yo‘q.");
  const q = (await bankRows([qid])).get(qid);
  const order = q
    ? optionOrder(
        b.id,
        uid,
        qid,
        q.options.map((o) => o.letter),
      )
    : [];
  const orig = letter ? (order[DISPLAY.indexOf(letter)] ?? null) : null;
  const ok = !!q && !!orig && (await gradeBankAnswer(q, orig));
  const { error } = await sb()
    .from("battle_answers")
    .insert({
      battle_id: b.id,
      user_id: uid,
      position,
      answer: orig,
      is_correct: ok,
      answered_ms: now - Date.parse(b.started_at),
    });
  if (error?.code === "23505") throw new ApiError(409, "order", "Bu savolga javob berilgan. Sahifani yangilang.");
  if (error) throw new Error(`battle answer: ${error.message}`);
  const answered = position + 1;
  const done = answered >= b.question_count;
  // Only progress is visible to the opponent; correctness stays hidden until the end.
  must(
    await sb()
      .from("battle_participants")
      .update({
        answered,
        ...(done ? { finished_at: new Date(now).toISOString() } : {}),
      })
      .eq("battle_id", b.id)
      .eq("user_id", uid),
    "battle progress",
  );
  if (done) {
    const after = await participants(b.id);
    if (after.length === 2 && after.every((p) => p.answered >= b.question_count)) await finalize(b);
  }
  return { ok, done };
}

/** Everything one player may see. Questions only once the battle has started; answers only after it ends. */
export async function battleView(uid: string, b: BattleRow) {
  b = await settle(b);
  const ps = await participants(b.id);
  const me = ps.find((p) => p.user_id === uid);
  const invited = b.mode === "friend" && b.invited_user === uid;
  if (!me && !invited) throw new ApiError(404, "not_found", "Battle topilmadi.");
  const started = (b.status === "active" && !!b.started_at && Date.now() >= Date.parse(b.started_at)) || b.status === "finished";
  let questions: {
    position: number;
    topic: string | null;
    stem: string;
    options: { letter: string; html: string }[];
  }[] = [];
  let mine: {
    position: number;
    ok: boolean | null;
    picked: string | null;
    correct: string | null;
  }[] = [];
  if (me && started) {
    const [qids, ans] = await Promise.all([questionIds(b.id), sb().from("battle_answers").select("position, answer, is_correct").eq("battle_id", b.id).eq("user_id", uid).order("position")]);
    const bank = await bankRows(qids);
    const finished = b.status === "finished";
    // While running: the current question only (no peeking ahead). After the end: all, with answers.
    const visible = finished ? qids.map((_, k) => k) : me.answered < qids.length ? [me.answered] : [];
    questions = visible.flatMap((k) => {
      const q = bank.get(qids[k]);
      if (!q) return [];
      const byLetter = new Map(q.options.map((o) => [o.letter, o.html]));
      const order = optionOrder(
        b.id,
        uid,
        q.id,
        q.options.map((o) => o.letter),
      );
      return [
        {
          position: k,
          topic: q.topic,
          stem: q.stem_html,
          options: order.map((orig, i) => ({
            letter: DISPLAY[i],
            html: byLetter.get(orig) ?? "",
          })),
        },
      ];
    });
    const rows = must(ans, "my battle answers") ?? [];
    mine = qids.map((qid, k) => {
      const r = rows.find((x) => x.position === k);
      const q = bank.get(qid);
      const order = q
        ? optionOrder(
            b.id,
            uid,
            qid,
            q.options.map((o) => o.letter),
          )
        : [];
      const toShown = (orig: string | null) => (orig && order.indexOf(orig) >= 0 ? DISPLAY[order.indexOf(orig)] : null);
      return {
        position: k,
        ok: r ? Boolean(r.is_correct) : null,
        picked: finished && r ? toShown(r.answer as string | null) : null,
        correct: finished && q ? toShown(q.correct) : null,
      };
    });
  }
  return {
    id: b.id,
    mode: b.mode,
    subjectCode: b.subject_code,
    status: b.status,
    inviteCode: b.created_by === uid ? b.invite_code : null,
    isCreator: b.created_by === uid,
    isInvited: invited && !me,
    questionCount: b.question_count,
    secPerQuestion: b.sec_per_question,
    startedAt: b.started_at ? Date.parse(b.started_at) : null,
    deadline: b.deadline_at ? Date.parse(b.deadline_at) : null,
    serverNow: Date.now(),
    winnerId: b.winner_id,
    me: uid,
    players: ps.map((p) => ({
      id: p.user_id,
      name: p.display_name,
      answered: p.answered,
      correct: b.status === "finished" ? p.correct : null,
      durationMs: b.status === "finished" ? p.duration_ms : null,
      done: !!p.finished_at,
    })),
    questions,
    mine,
  };
}

/** The student's battles: history, record and friend invitations waiting for them. */
export async function myBattles(uid: string) {
  const parts = must(await sb().from("battle_participants").select("battle_id").eq("user_id", uid).order("joined_at", { ascending: false }).limit(30), "my battle ids") ?? [];
  const ids = parts.map((p) => p.battle_id as string);
  const [rows, allPs, invites] = await Promise.all([
    ids.length ? sb().from("battles").select("*").in("id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb().from("battle_participants").select("*").in("battle_id", ids) : Promise.resolve({ data: [], error: null }),
    sb()
      .from("battles")
      .select("*")
      .eq("invited_user", uid)
      .eq("status", "waiting")
      .gte("created_at", new Date(Date.now() - BATTLE_WAIT_MS).toISOString()),
  ]);
  const battles = (must(rows, "my battles") ?? []) as BattleRow[];
  const ps = (must(allPs, "my battle players") ?? []) as ParticipantRow[];
  const inv = (must(invites, "invites") ?? []) as BattleRow[];
  const byId = new Map(battles.map((b) => [b.id, b]));
  let wins = 0,
    losses = 0,
    draws = 0;
  const history = ids.flatMap((id) => {
    const b = byId.get(id);
    if (!b) return [];
    const opp = ps.find((p) => p.battle_id === id && p.user_id !== uid);
    const me = ps.find((p) => p.battle_id === id && p.user_id === uid);
    let outcome: "win" | "loss" | "draw" | null = null;
    if (b.status === "finished") {
      outcome = b.winner_id === null ? "draw" : b.winner_id === uid ? "win" : "loss";
      if (outcome === "win") wins++;
      else if (outcome === "loss") losses++;
      else draws++;
    }
    return [
      {
        id,
        status: b.status,
        mode: b.mode,
        subjectCode: b.subject_code,
        createdAt: b.created_at,
        opponent: opp?.display_name ?? null,
        myCorrect: me?.correct ?? null,
        oppCorrect: opp?.correct ?? null,
        total: b.question_count,
        outcome,
      },
    ];
  });
  const inviterNames = new Map<string, string>();
  for (const b of inv) if (!inviterNames.has(b.created_by)) inviterNames.set(b.created_by, await displayName(b.created_by));
  return {
    record: { wins, losses, draws },
    history,
    invites: inv.map((b) => ({
      id: b.id,
      subjectCode: b.subject_code,
      from: inviterNames.get(b.created_by) ?? "",
      createdAt: b.created_at,
    })),
  };
}
