"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { flushReviews, pendingReviews } from "@/lib/offline-cards";

/**
 * Registers the service worker (production builds only — in development it would cache
 * hot-reloaded code) and sends flashcard reviews made offline once the connection is back.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    const sync = () => {
      if (!navigator.onLine || !pendingReviews().length) return;
      void flushReviews((r) => api("/api/flashcards/review", { method: "POST", body: { cardId: r.cardId, grade: r.grade } }));
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);
  return null;
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Ilovani o‘rnatish" — shown only when the browser offers installation. */
export function InstallButton({ className }: { className?: string }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const installed = () => setDone(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!evt || done) return null;
  return (
    <button
      type="button"
      className={className ?? "btn btn-sm"}
      onClick={async () => {
        await evt.prompt();
        const c = await evt.userChoice;
        if (c.outcome === "accepted") setDone(true);
        setEvt(null);
      }}
    >
      📲 Ilovani o‘rnatish
    </button>
  );
}

/** Thin banner while the device is offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-ink px-4 py-1.5 text-center text-xs text-paper no-print">
      Internet yo‘q — saqlangan sahifalar va{" "}
      {/* Full page load on purpose: offline, only the service worker can serve this page (client navigation would need the network). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/kartalar/oflayn" className="underline">
        oflayn kartalar
      </a>{" "}
      ishlaydi. Javoblar ulanish tiklanganda yuboriladi.
    </div>
  );
}
