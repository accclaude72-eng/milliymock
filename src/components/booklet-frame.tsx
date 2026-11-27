"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format-utils";
import { PageLoader } from "./ui";

/** Messages an interactive booklet may send to the platform (see `bridge`). */
export type BookletMessage = { mm: "ready" } | { mm: "answer"; n: number; value: string | null } | { mm: "focus"; n: number };

function parseMessage(d: unknown): BookletMessage | null {
  if (!d || typeof d !== "object") return null;
  const m = d as Record<string, unknown>;
  if (m.mm === "ready") return { mm: "ready" };
  if ((m.mm === "answer" || m.mm === "focus") && Number.isInteger(m.n) && (m.n as number) > 0 && (m.n as number) < 1000) {
    if (m.mm === "focus") return { mm: "focus", n: m.n as number };
    if (m.value === null) return { mm: "answer", n: m.n as number, value: null };
    if (typeof m.value === "string" && m.value.length <= 200) return { mm: "answer", n: m.n as number, value: m.value };
  }
  return null;
}

/**
 * Renders an HTML test booklet in an isolated sandbox.
 *
 * Preferred: fetch the (short-lived) Storage URL and render it via `srcdoc` in a frame
 * sandboxed WITHOUT allow-same-origin → the booklet gets an opaque origin, cannot touch
 * the platform, cookies or storage, cannot navigate the page and cannot open popups.
 * Fallback (e.g. bucket CORS not configured yet): load the URL directly in the same sandbox.
 *
 * Optional `bridge`: booklets that support in-booklet marking talk to the platform with
 * postMessage only. The platform pushes `bridge.state` into the frame (answers, which
 * questions are editable, or review marks) and receives answer/focus messages, which the
 * caller validates and saves like answer-sheet input. Messages from any other window are ignored.
 */
export function BookletFrame({
  url,
  title,
  zoom = 1,
  className,
  bridge,
}: {
  url: string;
  title: string;
  zoom?: number;
  className?: string;
  bridge?: { state: unknown; onMessage?: (m: BookletMessage) => void };
}) {
  const [doc, setDoc] = useState<{ url: string; html: string | null } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef(bridge);

  useEffect(() => {
    bridgeRef.current = bridge;
  });

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((html) => alive && setDoc({ url, html }))
      .catch(() => alive && setDoc({ url, html: null }));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [url]);

  const push = () => {
    const w = frame.current?.contentWindow;
    // the frame has an opaque origin, so "*" is the only possible target; only answer/mark data is sent
    if (w && bridgeRef.current) w.postMessage({ mm: "state", state: bridgeRef.current.state }, "*");
  };

  useEffect(() => {
    if (!bridge) return;
    const onMsg = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = parseMessage(e.data);
      if (!m) return;
      if (m.mm === "ready") push();
      else bridgeRef.current?.onMessage?.(m);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per bridge presence
  }, [!!bridge]);

  const stateJson = bridge ? JSON.stringify(bridge.state) : "";
  useEffect(() => {
    if (stateJson) push();
  }, [stateJson]);

  if (!doc || doc.url !== url)
    return (
      <div className={cx("grid h-full w-full place-items-center bg-white", className)}>
        <PageLoader label="Kitobcha yuklanmoqda…" />
      </div>
    );

  const common = {
    ref: frame,
    title,
    sandbox: "allow-scripts",
    referrerPolicy: "no-referrer" as const,
    className: cx("h-full w-full border-0 bg-white", className),
    style: { zoom },
    onLoad: push,
  };
  return doc.html !== null ? <iframe {...common} srcDoc={doc.html} /> : <iframe {...common} src={url} />;
}
