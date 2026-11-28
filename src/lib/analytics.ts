/**
 * Student analytics from real recorded data only (pure, unit tested).
 * Percentages are raw platform results — never presented as official certificate scores.
 */
export interface AttemptPoint {
  id: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  at: number; // submitted time (ms)
  percent: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  questions: number; // auto-graded questions counted
  durationMs: number;
  byTopic: Record<string, { correct: number; count: number }>;
}

export interface PracticePoint {
  at: number;
  correct: boolean;
}

const DAY = 86_400_000;
const r1 = (x: number) => Math.round(x * 10) / 10;
const avg = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const dayKey = (ms: number) => new Date(ms + 5 * 3600_000).toISOString().slice(0, 10); // Uzbekistan day

function window(points: AttemptPoint[], from: number, to: number) {
  const inside = points.filter((p) => p.at >= from && p.at < to);
  const correct = inside.reduce((s, p) => s + p.correct, 0);
  const total = inside.reduce((s, p) => s + p.questions, 0);
  return { exams: inside.length, avgPercent: avg(inside.map((p) => p.percent)), accuracy: total ? r1((correct / total) * 100) : null };
}

export function computeAnalytics(attempts: AttemptPoint[], practice: PracticePoint[], now: number) {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const correct = sorted.reduce((s, a) => s + a.correct, 0);
  const incorrect = sorted.reduce((s, a) => s + a.incorrect, 0);
  const unanswered = sorted.reduce((s, a) => s + a.unanswered, 0);
  const questions = sorted.reduce((s, a) => s + a.questions, 0);
  const studyMs = sorted.reduce((s, a) => s + a.durationMs, 0);
  const practiceCorrect = practice.filter((p) => p.correct).length;

  // Active days: a finished exam or a practice answer.
  const activeDays = new Set([...sorted.map((a) => dayKey(a.at)), ...practice.map((p) => dayKey(p.at))]);
  let streak = 0;
  for (let t = now; activeDays.has(dayKey(t)) || (streak === 0 && t === now); t -= DAY) {
    if (activeDays.has(dayKey(t))) streak++;
    else if (t !== now) break;
  }

  const daily = (days: number) =>
    Array.from({ length: days }, (_, i) => {
      const end = now - (days - 1 - i) * DAY;
      const key = dayKey(end);
      const exams = sorted.filter((a) => dayKey(a.at) === key);
      const prac = practice.filter((p) => dayKey(p.at) === key);
      return { day: key, exams: exams.length, avgPercent: avg(exams.map((a) => a.percent)), practiced: prac.length, practiceCorrect: prac.filter((p) => p.correct).length };
    });

  const subjects = new Map<string, { name: string; percents: number[]; correct: number; total: number }>();
  const topics = new Map<string, { subjectCode: string; correct: number; count: number }>();
  for (const a of sorted) {
    const s = subjects.get(a.subjectCode) ?? { name: a.subjectName, percents: [], correct: 0, total: 0 };
    s.percents.push(a.percent);
    s.correct += a.correct;
    s.total += a.questions;
    subjects.set(a.subjectCode, s);
    for (const [t, b] of Object.entries(a.byTopic)) {
      const k = `${a.subjectCode}|${t}`;
      const x = topics.get(k) ?? { subjectCode: a.subjectCode, correct: 0, count: 0 };
      x.correct += b.correct;
      x.count += b.count;
      topics.set(k, x);
    }
  }
  const topicRows = [...topics].map(([k, x]) => ({ subjectCode: x.subjectCode, topic: k.split("|")[1], accuracy: r1((x.correct / x.count) * 100), count: x.count }));

  const last = sorted.at(-1) ?? null;
  const prevSame = last ? [...sorted].reverse().find((a) => a.id !== last.id && a.subjectCode === last.subjectCode) ?? null : null;

  return {
    overview: {
      exams: sorted.length,
      avgPercent: avg(sorted.map((a) => a.percent)),
      bestPercent: sorted.length ? Math.max(...sorted.map((a) => a.percent)) : null,
      accuracy: questions ? r1((correct / questions) * 100) : null,
      questions,
      correct,
      incorrect,
      unanswered,
      practiceAnswers: practice.length,
      practiceAccuracy: practice.length ? r1((practiceCorrect / practice.length) * 100) : null,
      studyMinutes: Math.round(studyMs / 60_000),
      avgSecondsPerQuestion: questions ? Math.round(studyMs / 1000 / questions) : null,
      streak,
    },
    last7: daily(7),
    last30: daily(30),
    progression: sorted.map((a) => ({ id: a.id, at: a.at, percent: a.percent, subjectCode: a.subjectCode, title: a.title })),
    subjects: [...subjects].map(([code, s]) => ({ code, name: s.name, exams: s.percents.length, avgPercent: avg(s.percents), accuracy: s.total ? r1((s.correct / s.total) * 100) : null })),
    topics: topicRows.sort((a, b) => a.accuracy - b.accuracy),
    weakTopics: topicRows.filter((t) => t.count >= 2 && t.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy).slice(0, 8),
    compare: {
      lastMock: last && prevSame ? { last: { title: last.title, percent: last.percent, at: last.at }, previous: { title: prevSame.title, percent: prevSame.percent, at: prevSame.at }, delta: r1(last.percent - prevSame.percent) } : null,
      week: { current: window(sorted, now - 7 * DAY, now + 1), previous: window(sorted, now - 14 * DAY, now - 7 * DAY) },
      month: { current: window(sorted, now - 30 * DAY, now + 1), previous: window(sorted, now - 60 * DAY, now - 30 * DAY) },
    },
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;
