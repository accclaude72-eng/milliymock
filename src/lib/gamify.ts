/**
 * Gamification rules (pure, unit tested): XP amounts, achievements, seeded shuffling.
 * The server is the only place these run for real rewards.
 */

export interface XpRules {
  challengeBase: number; // completing a daily challenge (default; a challenge can override)
  bonus70: number; // ≥ 70 %
  bonus90: number; // ≥ 90 % (replaces the 70 % bonus)
  streak7: number; // every 7th consecutive challenge day
  mockPublished: number; // each published mock result
}

export const DEFAULT_XP_RULES: XpRules = { challengeBase: 20, bonus70: 10, bonus90: 20, streak7: 50, mockPublished: 30 };

export function challengeBonus(percent: number, rules: XpRules): number {
  if (percent >= 90) return rules.bonus90;
  if (percent >= 70) return rules.bonus70;
  return 0;
}

/* ------------------------------------------------------------- achievements */

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_challenge", title: "Birinchi qadam", description: "Birinchi kunlik challenge’ni yakunlang", icon: "🚀" },
  { code: "perfect_score", title: "Mukammal natija", description: "Challenge’da 100% natija", icon: "💯" },
  { code: "streak_7", title: "7 kunlik streak", description: "7 kun ketma-ket challenge", icon: "🔥" },
  { code: "streak_30", title: "30 kunlik streak", description: "30 kun ketma-ket challenge", icon: "🏆" },
  { code: "master_biologiya", title: "Biologiya ustasi", description: "Biologiyadan 3 ta e’lon qilingan mock, o‘rtacha ≥ 80%", icon: "🧬" },
  { code: "master_kimyo", title: "Kimyo ustasi", description: "Kimyodan 3 ta e’lon qilingan mock, o‘rtacha ≥ 80%", icon: "⚗️" },
  { code: "master_matematika", title: "Matematika ustasi", description: "Matematikadan 3 ta e’lon qilingan mock, o‘rtacha ≥ 80%", icon: "∑" },
  { code: "master_fizika", title: "Fizika ustasi", description: "Fizikadan 3 ta e’lon qilingan mock, o‘rtacha ≥ 80%", icon: "⚛" },
  { code: "consistency", title: "Barqarorlik chempioni", description: "Oxirgi 14 kunning kamida 10 kunida challenge", icon: "📅" },
  { code: "xp_1000", title: "1000 XP", description: "Jami 1000 XP to‘plang", icon: "⭐" },
];

export interface AchievementStats {
  challengesDone: number;
  bestPercent: number;
  streak: number;
  challengeDays: string[]; // YYYY-MM-DD of finished challenges
  today: string;
  totalXp: number;
  mocks: Record<string, { count: number; avg: number }>;
}

export function earnedAchievements(s: AchievementStats): string[] {
  const out: string[] = [];
  if (s.challengesDone >= 1) out.push("first_challenge");
  if (s.bestPercent >= 100) out.push("perfect_score");
  if (s.streak >= 7) out.push("streak_7");
  if (s.streak >= 30) out.push("streak_30");
  for (const code of ["biologiya", "kimyo", "matematika", "fizika"]) {
    const m = s.mocks[code];
    if (m && m.count >= 3 && m.avg >= 80) out.push(`master_${code}`);
  }
  const from = Date.parse(`${s.today}T00:00:00Z`) - 13 * 86_400_000;
  const recent = new Set(s.challengeDays.filter((d) => Date.parse(`${d}T00:00:00Z`) >= from));
  if (recent.size >= 10) out.push("consistency");
  if (s.totalXp >= 1000) out.push("xp_1000");
  return out;
}

/* ------------------------------------------------------------- seeded shuffle */

/** Small deterministic PRNG (mulberry32) seeded from a string. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Per-student layout: question order and, per question, which original option sits at each displayed letter. */
export interface Layout {
  order: string[]; // question ids in display order
  options: Record<string, string[]>; // questionId → original letters in display order
}

export function makeLayout(questions: { id: string; letters: string[] }[], seed: string): Layout {
  const r = rng(seed);
  return {
    order: shuffled(questions.map((q) => q.id), r),
    options: Object.fromEntries(questions.map((q) => [q.id, shuffled(q.letters, r)])),
  };
}

export const DISPLAY = "ABCDEFGHIJ";

/** Displayed letter (A, B…) → the question's original letter. */
export function originalLetter(layout: Layout, questionId: string, displayed: string): string | null {
  const i = DISPLAY.indexOf(displayed.toUpperCase());
  return layout.options[questionId]?.[i] ?? null;
}
