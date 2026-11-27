"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/format-utils";
import { CountUp } from "./reveal";

/** Wordmark: the "O" in MOCK is a filled answer bubble. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-baseline gap-[0.18em] font-mono font-semibold tracking-[0.08em] text-ink select-none", className)} aria-label="Milliy Mock">
      {!compact && <span aria-hidden>MILLIY</span>}
      <span aria-hidden className="inline-flex items-baseline">
        M
        <span className="relative mx-[0.04em] inline-block h-[0.74em] w-[0.74em] translate-y-[0.02em] rounded-full bg-accent ring-[1.5px] ring-ink" />
        CK
      </span>
    </span>
  );
}

export function Spinner({ className, label = "Yuklanmoqda" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />
  );
}

export function PageLoader({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted" role="status">
      <Spinner />
      <span className="font-mono text-sm">{label}</span>
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "error" | "ok"; title?: string; children?: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-info bg-info-soft text-info",
    warn: "border-warn bg-warn-soft text-warn",
    error: "border-accent bg-accent-soft text-accent-ink",
    ok: "border-ok bg-ok-soft text-ok",
  } as const;
  const icon = { info: "i", warn: "!", error: "×", ok: "✓" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 rounded-[3px] border-[1.5px] px-4 py-3 text-sm", tones[tone], className)}>
      <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] border-current font-mono text-[0.7rem] font-bold">
        {icon}
      </span>
      <div className="min-w-0 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "text-ink-2 [&_a]:underline")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="graph-paper crop rounded-[3px] border-[1.5px] border-dashed border-ink/50 px-6 py-10 text-center">
      <div aria-hidden className="mx-auto mb-4 flex justify-center gap-1.5">
        {["A", "B", "C", "D"].map((l) => (
          <span key={l} className="bubble bubble-sm cursor-default">
            {l}
          </span>
        ))}
      </div>
      <p className="display text-2xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Accessible modal built on native <dialog> (focus trap + Esc handled by the browser). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissable = true,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissable?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-[3px] border-[1.5px] border-ink bg-card p-0 text-ink shadow-hard backdrop:bg-ink/40 open:animate-rise",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b-[1.5px] border-ink px-5 py-4">
            <h2 id="modal-title" className="display text-2xl">
              {title}
            </h2>
            {dismissable && (
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm -mr-2 -mt-1 min-h-0 px-2" aria-label="Yopish">
                ✕
              </button>
            )}
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-hair bg-paper/60 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function SectionHead({ index, eyebrow, title, children, className }: { index?: string; eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-end", className)}>
      <div>
        {(index || eyebrow) && (
          <p className="eyebrow mb-3 flex items-center gap-3">
            {index && <span className="text-accent">§ {index}</span>}
            {eyebrow}
          </p>
        )}
        <h2 className="display text-4xl sm:text-5xl">{title}</h2>
      </div>
      {children && <div className="max-w-xl text-ink-2 md:justify-self-end">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "accent" | "ok" }) {
  return (
    <div className="sheet lift p-4 animate-rise">
      <p className="eyebrow">{label}</p>
      <p className={cx("num mt-2 text-3xl font-semibold", tone === "accent" && "text-accent", tone === "ok" && "text-ok")}>
        {typeof value === "number" ? <CountUp to={value} duration={900} /> : value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, max = 100, label, tone = "ink" }: { value: number; max?: number; label?: string; tone?: "ink" | "accent" | "ok" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { ink: "bg-ink", accent: "bg-accent", ok: "bg-ok" }[tone];
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-[2px] border border-ink bg-card">
      <div className={cx("h-full transition-[width] duration-700 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("link", className)}>
      {children}
    </Link>
  );
}
