import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-session";
import { challengePool, pickQuestions } from "@/lib/server/challenges";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { audit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";

/** Recent and scheduled challenges with participation numbers, plus suspicious attempts. */
export const GET = route(async () => {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const list = must(await sb().from("daily_challenges").select("id, day, subject_code, title, difficulty, question_ids, time_limit_sec, one_attempt, xp_base, status, source").gte("day", since).order("day", { ascending: false }).limit(200), "admin challenges") ?? [];
  const ids = list.map((c) => c.id);
  const att = ids.length ? (must(await sb().from("challenge_attempts").select("id, challenge_id, user_id, status, percent, duration_ms, total, flagged, submitted_at").in("challenge_id", ids), "admin attempts") ?? []) : [];
  const flagged = att.filter((a) => a.flagged);
  const names = flagged.length
    ? new Map((must(await sb().from("profiles").select("id, candidate_id, doc->>firstName, doc->>lastName").in("id", [...new Set(flagged.map((f) => f.user_id))]), "flag names") ?? []).map((p) => [p.id, `${p.firstName} ${p.lastName} (${p.candidate_id})`]))
    : new Map();
  return ok({
    challenges: list.map((c) => {
      const mine = att.filter((a) => a.challenge_id === c.id && a.status === "submitted");
      return {
        ...c,
        questions: (c.question_ids as string[]).length,
        participants: new Set(mine.map((a) => a.user_id)).size,
        avgPercent: mine.length ? Math.round((mine.reduce((s, a) => s + Number(a.percent), 0) / mine.length) * 10) / 10 : null,
        flagged: att.filter((a) => a.challenge_id === c.id && a.flagged).length,
      };
    }),
    flagged: flagged.map((f) => ({ ...f, name: names.get(f.user_id) ?? f.user_id, title: list.find((c) => c.id === f.challenge_id)?.title ?? "" })),
  });
});

const Create = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subjectCode: z.string().regex(/^[a-z0-9-]{1,40}$/),
  title: z.string().trim().min(3).max(120),
  count: z.number().int().min(3).max(50),
  difficulty: z.number().int().min(1).max(5).nullable(),
  timeLimitSec: z.number().int().min(60).max(7200),
  oneAttempt: z.boolean(),
  xp: z.number().int().min(0).max(500),
  replace: z.boolean().default(false),
});

/** Schedules a challenge for a day; questions are picked from the real bank of that subject. */
export const POST = route(async (req) => {
  assertSameOrigin(req);
  await requireAdmin();
  const b = Create.parse(await readJson(req));
  const pool = await challengePool(b.subjectCode, b.difficulty);
  const ids = pickQuestions(pool, b.count, `admin:${b.day}:${b.subjectCode}:${Date.now()}`);
  if (ids.length < Math.min(3, b.count)) throw new ApiError(400, "no_questions", `Bu fan${b.difficulty ? " va qiyinlik" : ""} bo‘yicha javoblari ochiq savollar yetarli emas (${pool.length} ta).`);
  const existing = must(await sb().from("daily_challenges").select("id").eq("day", b.day).eq("subject_code", b.subjectCode).maybeSingle(), "existing");
  if (existing) {
    const started = must(await sb().from("challenge_attempts").select("id").eq("challenge_id", existing.id).limit(1), "started");
    if (started?.length) throw new ApiError(409, "started", "Bu kungi challenge’ni nomzodlar allaqachon boshlagan — uni almashtirib bo‘lmaydi.");
    if (!b.replace) throw new ApiError(409, "exists", "Bu kun va fan uchun challenge bor. Almashtirish uchun “replace” ni belgilang.");
  }
  const row = { day: b.day, subject_code: b.subjectCode, title: b.title, difficulty: b.difficulty, question_ids: ids, time_limit_sec: b.timeLimitSec, one_attempt: b.oneAttempt, xp_base: b.xp, status: "published", source: "admin" };
  const saved = (existing
    ? must(await sb().from("daily_challenges").update(row).eq("id", existing.id).select("id").single(), "replace challenge")
    : must(await sb().from("daily_challenges").insert(row).select("id").single(), "create challenge")) as { id: string };
  await audit("challenge.create", `challenges/${saved.id}`, { day: b.day, subject: b.subjectCode, questions: ids.length });
  return ok({ id: saved.id, questions: ids.length }, 201);
});
