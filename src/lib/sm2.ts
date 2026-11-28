/**
 * SM-2 spaced repetition for flashcards (pure, unit tested).
 * Grade 0–5 (the UI offers 1 "Qayta", 3 "Qiyin", 4 "Yaxshi", 5 "Oson").
 * Grade < 3 → the card starts over (tomorrow) and counts as a lapse.
 */
export interface CardState {
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
}

export const NEW_CARD: CardState = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0 };
export const MIN_EASE = 1.3;
export const MAX_INTERVAL = 3650;
export const NEW_PER_DAY = 20;

export const GRADES = [
  { grade: 1, label: "Qayta", hint: "eslay olmadim" },
  { grade: 3, label: "Qiyin", hint: "qiynalib esladim" },
  { grade: 4, label: "Yaxshi", hint: "esladim" },
  { grade: 5, label: "Oson", hint: "darhol esladim" },
] as const;

export function review(prev: CardState, grade: number): CardState {
  const q = Math.max(0, Math.min(5, Math.round(grade)));
  const ease = Math.max(MIN_EASE, Math.round((prev.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  if (q < 3) return { ease, interval_days: 1, repetitions: 0, lapses: prev.lapses + 1 };
  const repetitions = prev.repetitions + 1;
  // First success: 1 day (4 days if it was easy); second: 6 days; then interval × ease.
  const interval = repetitions === 1 ? (q === 5 ? 4 : 1) : repetitions === 2 ? 6 : Math.round(prev.interval_days * prev.ease);
  return { ease, interval_days: Math.min(MAX_INTERVAL, Math.max(1, interval)), repetitions, lapses: prev.lapses };
}

/** YYYY-MM-DD + n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Next interval (days) for each grade — shown on the buttons. */
export function previewIntervals(prev: CardState): Record<number, number> {
  return Object.fromEntries(GRADES.map((g) => [g.grade, review(prev, g.grade).interval_days]));
}

/** Parses "front | back" lines (bulk add). Lines without a separator are skipped. */
export function parseCardLines(text: string): { front: string; back: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((l) => {
      const i = l.indexOf("|");
      if (i < 0) return [];
      const front = l.slice(0, i).trim();
      const back = l.slice(i + 1).trim();
      return front && back ? [{ front: front.slice(0, 2000), back: back.slice(0, 2000) }] : [];
    });
}

/** YouTube / Vimeo link (or bare id) → provider + id. */
export function parseVideoUrl(input: string): { provider: "youtube" | "vimeo"; ref: string } | null {
  const s = input.trim();
  let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { provider: "youtube", ref: m[1] };
  m = s.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
  if (m) return { provider: "vimeo", ref: m[1] };
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { provider: "youtube", ref: s };
  return null;
}

export function embedUrl(provider: "youtube" | "vimeo", ref: string): string {
  return provider === "youtube" ? `https://www.youtube-nocookie.com/embed/${ref}?rel=0` : `https://player.vimeo.com/video/${ref}?dnt=1`;
}
