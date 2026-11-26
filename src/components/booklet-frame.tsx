"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/format-utils";
import { PageLoader } from "./ui";

/**
 * Renders an HTML test booklet in an isolated sandbox.
 *
 * Preferred: fetch the (short-lived) Storage URL and render it via `srcdoc` in a frame
 * sandboxed WITHOUT allow-same-origin → the booklet gets an opaque origin, cannot touch
 * the platform, cookies or storage, cannot navigate the page and cannot open popups.
 * Fallback (e.g. bucket CORS not configured yet): load the URL directly in the same sandbox.
 */
export function BookletFrame({ url, title, zoom = 1, className }: { url: string; title: string; zoom?: number; className?: string }) {
  const [doc, setDoc] = useState<{ url: string; html: string | null } | null>(null);

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

  if (!doc || doc.url !== url)
    return (
      <div className={cx("grid h-full w-full place-items-center bg-white", className)}>
        <PageLoader label="Kitobcha yuklanmoqda…" />
      </div>
    );

  const common = {
    title,
    sandbox: "allow-scripts",
    referrerPolicy: "no-referrer" as const,
    className: cx("h-full w-full border-0 bg-white", className),
    style: { zoom },
  };
  return doc.html !== null ? <iframe {...common} srcDoc={doc.html} /> : <iframe {...common} src={url} />;
}
