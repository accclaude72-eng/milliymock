/**
 * Deterministic study-plan generator (pure, unit tested — no AI, no I/O).
 * Spreads topics over the student's study days, weighted by real weakness (lower accuracy → more
 * time) and priority, adds mistake reviews, a weekly assessment every 7th study day and full mocks
 * close to the exam date.
 */
export type TaskKind = "practice" | "mistakes" | "topic_review" | "assessment" | "mock";

export interface PlanTask {
  day: string; // YYYY-MM-DD
  kind: TaskKind;
  title: string;
  topic: string | null;
  target_count: number | null;
  minutes: number;
}

export interface PlanInput {
  today: string; // YYYY-MM-DD (start day, inclusive)
  examDate: string; // YYYY-MM-DD (exclusive — the exam day itself is not planned)
  studyDays: number[]; // 0 = Sunday … 6 = Saturday
  dailyMinutes: number;
  topics: { name: string; accuracy: number | null }[]; // accuracy 0..100 from real results, null = no data
  priority: string[];
  dueMistakes: number; // unresolved mistakes in this subject
  maxDays?: number;
}

const DAY = 86_400_000;
export const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (d: string) => Date.parse(`${d}T00:00:00Z`);

export function weightOf(t: { name: string; accuracy: number | null }, priority: string[]): number {
  const weakness = t.accuracy == null ? 0.6 : 1 - Math.min(100, Math.max(0, t.accuracy)) / 100;
  return (weakness + 0.15) * (priority.includes(t.name) ? 1.6 : 1);
}

/** Study days between today and the exam (exam day excluded), capped at maxDays calendar days. */
export function studyDates(input: Pick<PlanInput, "today" | "examDate" | "studyDays" | "maxDays">): string[] {
  const start = parseDay(input.today);
  const end = Math.min(parseDay(input.examDate), start + (input.maxDays ?? 180) * DAY);
  const days: string[] = [];
  for (let t = start; t < end; t += DAY) if (input.studyDays.includes(new Date(t).getUTCDay())) days.push(toDay(t));
  return days;
}

export function generatePlan(input: PlanInput): PlanTask[] {
  const dates = studyDates(input);
  if (!dates.length || !input.topics.length) return [];
  const minutes = Math.max(10, Math.min(600, Math.round(input.dailyMinutes)));
  const weights = input.topics.map((t) => weightOf(t, input.priority));
  const total = weights.reduce((s, w) => s + w, 0);
  const credit = weights.map(() => 0);
  // Two full mocks before the exam when there is enough time: the last study day and ~a week before.
  const mockDays = new Set<string>();
  if (dates.length >= 3) mockDays.add(dates[dates.length - 1]);
  if (dates.length >= 10) mockDays.add(dates[dates.length - 6]);

  const tasks: PlanTask[] = [];
  let mistakesLeft = input.dueMistakes;
  dates.forEach((day, k) => {
    if (mockDays.has(day)) {
      tasks.push({ day, kind: "mock", title: "To‘liq mock imtihon (real vaqt bilan)", topic: null, target_count: null, minutes });
      return;
    }
    if (k % 7 === 6) {
      tasks.push({ day, kind: "assessment", title: "Haftalik baholash: aralash savollar", topic: null, target_count: Math.max(10, Math.min(40, Math.round(minutes / 2))), minutes });
      return;
    }
    // Smooth weighted round-robin: the topic with the most accumulated credit goes next.
    for (let i = 0; i < credit.length; i++) credit[i] += weights[i];
    let best = 0;
    for (let i = 1; i < credit.length; i++) if (credit[i] > credit[best]) best = i;
    credit[best] -= total;
    const topic = input.topics[best].name;

    const reviewMin = mistakesLeft > 0 || k % 2 === 1 ? Math.max(5, Math.round(minutes * 0.25)) : 0;
    const theoryMin = Math.max(5, Math.round(minutes * 0.15));
    const practiceMin = Math.max(5, minutes - reviewMin - theoryMin);
    tasks.push({ day, kind: "topic_review", title: `${topic}: nazariyani takrorlash`, topic, target_count: null, minutes: theoryMin });
    tasks.push({ day, kind: "practice", title: `${topic}: mashq savollari`, topic, target_count: Math.max(5, Math.min(60, Math.round(practiceMin / 1.5))), minutes: practiceMin });
    if (reviewMin) {
      const n = Math.max(3, Math.min(15, Math.round(reviewMin / 2)));
      tasks.push({ day, kind: "mistakes", title: "Xatolar daftarini takrorlash", topic: null, target_count: n, minutes: reviewMin });
      mistakesLeft = Math.max(0, mistakesLeft - n);
    }
  });
  return tasks;
}

/** Consecutive days (ending today or yesterday) with at least one completed task. */
export function streak(doneDays: string[], today: string): number {
  const set = new Set(doneDays);
  let t = parseDay(today);
  if (!set.has(toDay(t))) t -= DAY;
  let n = 0;
  while (set.has(toDay(t))) {
    n++;
    t -= DAY;
  }
  return n;
}
