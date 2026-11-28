import { z } from "zod";
import { streak } from "@/lib/study-plan";
import { ApiError, assertSameOrigin, ok, readJson, route } from "@/lib/server/http";
import { PlanSettings, type PlanRow, accuracyFrom, regenerate, subjectTopics, todayUz } from "@/lib/server/plans";
import { attemptsOf, listSubjects, rateLimit } from "@/lib/server/repo";
import { must, sb } from "@/lib/server/supabase";
import { requireCandidate } from "@/lib/server/user-auth";

/** Live (non-archived) plans with their tasks, streak and missed-task counts. */
export const GET = route(async (req) => {
  const { user } = await requireCandidate(req);
  // Everything in parallel: plans, the student's tasks, subjects (with topics) and results.
  const [plansRes, tasksRes, subjects, attempts] = await Promise.all([
    sb().from("study_plans").select("*").eq("user_id", user.uid).neq("status", "archived").order("created_at"),
    sb().from("study_plan_tasks").select("*").eq("user_id", user.uid).order("day").order("id").limit(5000),
    listSubjects(true),
    attemptsOf({ uid: user.uid }),
  ]);
  const plans = (must(plansRes, "plans") ?? []) as PlanRow[];
  const live = new Set(plans.map((p) => p.id));
  const tasks = (must(tasksRes, "plan tasks") ?? []).filter((t) => live.has(t.plan_id));
  const today = todayUz();
  const doneDays = [...new Set(tasks.filter((t) => t.status === "done" && t.done_at).map((t) => (t.done_at as string).slice(0, 10)))];
  const out = await Promise.all(
    plans.map(async (p) => {
      const mine = tasks.filter((t) => t.plan_id === p.id);
      const s = subjects.find((x) => x.code === p.subject_code);
      const name = s?.name ?? p.subject_code;
      const topics = s?.format?.topics ?? [];
      const acc = accuracyFrom(attempts, p.subject_code);
      return {
        ...p,
        subjectName: name,
        topics: topics.map((t) => ({ name: t, accuracy: acc.get(t) ?? null })),
        tasks: mine,
        stats: {
          total: mine.length,
          done: mine.filter((t) => t.status === "done").length,
          missed: mine.filter((t) => t.status === "todo" && t.day < today).length,
          todayTotal: mine.filter((t) => t.day === today).length,
          todayDone: mine.filter((t) => t.day === today && t.status === "done").length,
        },
      };
    }),
  );
  return ok({ today, streak: streak(doneDays, today), plans: out });
});



const Create = PlanSettings.extend({ subjectCode: z.string().regex(/^[a-z0-9-]{1,40}$/) });

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const { user } = await requireCandidate(req);
  if (!(await rateLimit(`plan:${user.uid}`, 20, 60 * 60_000))) throw new ApiError(429, "rate_limited", "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.");
  const b = Create.parse(await readJson(req));
  if (b.examDate <= todayUz()) throw new ApiError(400, "bad_date", "Imtihon sanasi bugundan keyin bo‘lishi kerak.");
  const { topics } = await subjectTopics(b.subjectCode);
  const priority = b.priorityTopics.filter((t) => topics.includes(t));
  const { data, error } = await sb()
    .from("study_plans")
    .insert({
      user_id: user.uid,
      subject_code: b.subjectCode,
      exam_date: b.examDate,
      target_score: b.targetScore,
      current_estimate: b.currentEstimate,
      daily_minutes: b.dailyMinutes,
      study_days: [...new Set(b.studyDays)].sort(),
      priority_topics: priority,
    })
    .select("*")
    .single();
  if (error?.code === "23505") throw new ApiError(409, "exists", "Bu fan bo‘yicha rejangiz allaqachon bor. Uni tahrirlang yoki qayta tuzing.");
  const plan = must({ data, error }, "plan create") as PlanRow;
  const count = await regenerate(plan);
  return ok({ id: plan.id, tasks: count }, 201);
});
