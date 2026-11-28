import { beforeEach, describe, expect, it } from "vitest";
import { flushReviews, pendingReviews, queueReview, removeDeck, saveDeck, savedDecks } from "@/lib/offline-cards";

// Minimal in-memory localStorage for the node test environment.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const deck = (id: string) => ({ id, title: `D${id}`, savedAt: 1, cards: [{ id: `${id}-c`, front: "f", back: "b", html: false }] });

describe("offline decks", () => {
  it("saves newest first, replaces the same deck, keeps at most 10", () => {
    for (let i = 0; i < 12; i++) saveDeck(deck(String(i)));
    saveDeck(deck("5"));
    const list = savedDecks();
    expect(list.length).toBe(10);
    expect(list[0].id).toBe("5");
    expect(list.filter((d) => d.id === "5").length).toBe(1);
    removeDeck("5");
    expect(savedDecks().some((d) => d.id === "5")).toBe(false);
  });
});

describe("offline review queue", () => {
  it("sends queued reviews and clears them", async () => {
    queueReview({ cardId: "a", grade: 4 });
    queueReview({ cardId: "b", grade: 1 });
    const sent: string[] = [];
    expect(await flushReviews(async (r) => void sent.push(r.cardId))).toBe(2);
    expect(sent).toEqual(["a", "b"]);
    expect(pendingReviews()).toEqual([]);
  });
  it("keeps reviews that failed because of the network; drops 4xx (card gone)", async () => {
    queueReview({ cardId: "net", grade: 4 });
    queueReview({ cardId: "gone", grade: 4 });
    queueReview({ cardId: "limited", grade: 4 });
    await flushReviews(async (r) => {
      if (r.cardId === "net") throw new Error("offline");
      if (r.cardId === "gone") throw Object.assign(new Error("404"), { status: 404 });
      throw Object.assign(new Error("429"), { status: 429 });
    });
    expect(pendingReviews().map((r) => r.cardId)).toEqual(["net", "limited"]);
  });
  it("stamps the time when queued", () => {
    queueReview({ cardId: "t", grade: 3 });
    expect(pendingReviews()[0].at).toBeGreaterThan(0);
  });
});
