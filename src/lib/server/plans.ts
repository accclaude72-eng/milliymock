import "server-only";
import { z } from "zod";
import { type PlanTask, generatePlan, toDay } from "@/lib/study-plan";
import type { Attempt } from "@/lib/types";
import { attemptsOf, getFormat, getSubject } from "./repo";
import { must, sb } from "./supabase";

/** Student-editable plan settings (shared by create and update). */
export const PlanSettings = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetScore: z.number().int().min(0).max(100).nullable(),
  currentEstimate: z.number().int().min(0).max(100).nullable(),
  dailyMinutes: z.number().int().min(10).max(600),
  studyDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  priorityTopics: z.array(z.string().trim().min(1).max(200)).max(20),
});

/** "Today" in Uzbekistan (UTC+5) — plans are day-based for the student, not for the server. */
export const todayUz = () => toDay(Date.now() + 5 * 3600_000);

export interface PlanRow {
  id: string;
  user_id: string;
  subject_code: string;
  target_score: number | null;
  exam_date: string;
  current_estimate: number | null;
  daily_minutes: number;
  study_days: number[];
  priority_topics: string[];
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
}

/** Topic accuracy from the student's real published results in this subject. */
export async function topicAccuracy(uid: string, subjectCode: string): Promise<Map<string, number>> {
  return accuracyFrom(await attemptsOf({ uid }), subjectCode);
}

export function accuracyFrom(attempts: Attempt[], subjectCode: string): Map<string, number> {
  const acc = new Map<string, { c: number; n: number }>();
  for (const a of attempts) {
    if (a.subjectCode !== subjectCode || a.status !== "published" || !a.grading) continue;
    for (const [topic, b] of Object.entries(a.grading.summary.byTopic)) {
      const x = acc.get(topic) ?? { c: 0, n: 0 };
      x.c += b.correct;
      x.n += b.count;
      acc.set(topic, x);
    }
  }
  return new Map([...acc].filter(([, x]) => x.n > 0).map(([t, x]) => [t, Math.round((x.c / x.n) * 100)]));
}

export async function subjectTopics(subjectCode: string): Promise<{ name: string; topics: string[] }> {
  const s = await getSubject(subjectCode);
  const f = await getFormat(s.activeFormatId);
  return { name: s.name, topics: f.topics };
}

/** Deletes the plan's future unfinished tasks and generates new ones from today with the current settings. */
export async function regenerate(plan: PlanRow): Promise<number> {
  const today = todayUz();
  must(await sb().from("study_plan_tasks").delete().eq("plan_id", plan.id).eq("status", "todo").gte("day", today), "plan clear future");
  if (plan.status !== "active") return 0;
  const [{ topics }, acc, due] = await Promise.all([
    subjectTopics(plan.subject_code),
    topicAccuracy(plan.user_id, plan.subject_code),
    sb().from("student_mistakes").select("id", { count: "exact", head: true }).eq("user_id", plan.user_id).eq("subject_code", plan.subject_code).neq("status", "resolved"),
  ]);
  // Days that already have finished work keep it; new tasks start from today.
  const tasks: PlanTask[] = generatePlan({
    today,
    examDate: plan.exam_date,
    studyDays: plan.study_days,
    dailyMinutes: plan.daily_minutes,
    topics: topics.map((name) => ({ name, accuracy: acc.get(name) ?? null })),
    priority: plan.priority_topics,
    dueMistakes: due.count ?? 0,
  });
  // Days that already hold finished / skipped work keep it as is — no duplicate tasks on those days.
  const kept = must(await sb().from("study_plan_tasks").select("day").eq("plan_id", plan.id).gte("day", today), "plan kept days") ?? [];
  const busy = new Set(kept.map((r) => r.day as string));
  const fresh = tasks.filter((t) => !busy.has(t.day));
  if (!fresh.length) return 0;
  for (let i = 0; i < fresh.length; i += 500) {
    must(await sb().from("study_plan_tasks").insert(fresh.slice(i, i + 500).map((t) => ({ ...t, plan_id: plan.id, user_id: plan.user_id }))), "plan insert");
  }
  return fresh.length;
}
