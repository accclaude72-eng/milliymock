"use client";

/*
 * Flashcard decks saved on this device for offline study, and reviews made offline that are
 * sent to the server when the connection returns. Stored in localStorage (this device only).
 * Only study material is stored — never answers to exams, tokens or personal data.
 */
export interface OfflineCard {
  id: string;
  front: string;
  back: string;
  html: boolean;
}
export interface OfflineDeck {
  id: string;
  title: string;
  savedAt: number;
  cards: OfflineCard[];
}
export interface PendingReview {
  cardId: string;
  grade: number;
  at: number;
}

const DECKS = "mm-offline-decks";
const QUEUE = "mm-offline-reviews";
const MAX_DECKS = 10;

const read = <T>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown): boolean => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false; // storage full or blocked
  }
};

export const savedDecks = (): OfflineDeck[] => read<OfflineDeck[]>(DECKS, []);

export function saveDeck(d: OfflineDeck): boolean {
  const rest = savedDecks().filter((x) => x.id !== d.id);
  return write(DECKS, [d, ...rest].slice(0, MAX_DECKS));
}

export function removeDeck(id: string): void {
  write(
    DECKS,
    savedDecks().filter((x) => x.id !== id),
  );
}

export const pendingReviews = (): PendingReview[] => read<PendingReview[]>(QUEUE, []);

export function queueReview(r: Omit<PendingReview, "at">): void {
  write(QUEUE, [...pendingReviews(), { ...r, at: Date.now() }].slice(-2000));
}

/** Sends queued reviews one by one; keeps the ones that failed for the next try. Returns how many were sent. */
export async function flushReviews(send: (r: PendingReview) => Promise<unknown>): Promise<number> {
  const queue = pendingReviews();
  if (!queue.length) return 0;
  const left: PendingReview[] = [];
  let sent = 0;
  for (const r of queue) {
    try {
      await send(r);
      sent++;
    } catch (e) {
      // 4xx = the card is gone or not allowed → drop it; network / 5xx → retry later.
      const status = (e as { status?: number }).status ?? 0;
      if (!(status >= 400 && status < 500 && status !== 429)) left.push(r);
    }
  }
  write(QUEUE, left);
  return sent;
}

/** Asks the service worker to cache a page together with its script chunks. */
export async function precachePage(path: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return;
  let urls = [path];
  try {
    const html = await (await fetch(path, { credentials: "same-origin" })).text();
    urls = [path, ...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
  } catch {
    // offline: nothing more to add
  }
  reg.active.postMessage({ type: "precache", urls });
}
