"use client";

import { useEffect, useRef } from "react";
import { clientConfigured, supabase } from "@/lib/supabase/client";

/**
 * Calls `onChange` when rows matching the filters change (Supabase Realtime; RLS decides what this
 * student may receive), and also every `pollMs` as a fallback in case the socket is down.
 * The server remains the source of truth — the event only says "reload".
 */
export function useLive(key: string | null, subs: { table: string; filter: string }[], onChange: () => void, pollMs = 5000) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const subsKey = JSON.stringify(subs);
  useEffect(() => {
    if (!key) return;
    const poll = window.setInterval(() => cb.current(), pollMs);
    if (!clientConfigured) return () => window.clearInterval(poll);
    let t: number | undefined;
    // Several rows may change at once → one reload.
    const fire = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => cb.current(), 150);
    };
    const ch = supabase().channel(`live:${key}`);
    for (const s of JSON.parse(subsKey) as { table: string; filter: string }[]) ch.on("postgres_changes", { event: "*", schema: "public", table: s.table, filter: s.filter }, fire);
    ch.subscribe();
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(t);
      void supabase().removeChannel(ch);
    };
  }, [key, subsKey, pollMs]);
}
