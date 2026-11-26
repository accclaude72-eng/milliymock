"use client";

import { useId, useState } from "react";
import { cx, fmtDate, fmtNum } from "@/lib/format-utils";

/** Responsive progress line chart (0–100%). Points in chronological order. */
export function ProgressLine({ points, height = 200 }: { points: { x: number; y: number; label: string }[]; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 34, r: 12, t: 14, b: 26 };
  const n = points.length;
  const xs = (i: number) => pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const ys = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
  const area = n > 1 ? `${path} L${xs(n - 1)},${ys(0)} L${xs(0)},${ys(0)} Z` : "";
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Oxirgi {n} ta urinish bo‘yicha xom natija foizi</title>
        <defs>
          <pattern id={`${id}-h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-accent)" strokeWidth="1.2" opacity="0.35" />
          </pattern>
        </defs>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke="var(--color-hair)" strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={ys(g) + 4} textAnchor="end" className="fill-[var(--color-muted)] font-mono text-[10px]">
              {g}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${id}-h)`} />}
        <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" className="[stroke-dasharray:2000] [stroke-dashoffset:2000] animate-[draw_1.2s_ease-out_forwards]" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${p.label}: ${fmtNum(p.y)}%`}>
            <circle cx={xs(i)} cy={ys(p.y)} r={hover === i ? 6 : 4.5} fill={hover === i ? "var(--color-accent)" : "var(--color-card)"} stroke="var(--color-ink)" strokeWidth="1.8" />
            <rect x={xs(i) - 14} y={pad.t} width="28" height={H - pad.t - pad.b} fill="transparent" />
          </g>
        ))}
        {hover !== null && points[hover] && (
          <g pointerEvents="none">
            <rect x={Math.min(Math.max(xs(hover) - 62, 0), W - 124)} y={Math.max(ys(points[hover].y) - 44, 0)} width="124" height="34" rx="2" fill="var(--color-ink)" />
            <text x={Math.min(Math.max(xs(hover), 62), W - 62)} y={Math.max(ys(points[hover].y) - 23, 21)} textAnchor="middle" className="fill-[var(--color-paper)] font-mono text-[11px]">
              {fmtNum(points[hover].y)}% · {fmtDate(points[hover].x)}
            </text>
          </g>
        )}
      </svg>
      <style>{`@keyframes draw{to{stroke-dashoffset:0}}`}</style>
    </figure>
  );
}

/** Horizontal bars with labels; values in percent. Low values highlighted in accent. */
export function TopicBars({ rows, threshold = 50 }: { rows: { label: string; value: number; detail?: string }[]; threshold?: number }) {
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={r.label}>
              {r.label}
            </span>
            <span className="num shrink-0 text-xs">
              {r.detail && <span className="mr-2 text-muted">{r.detail}</span>}
              <span className={cx("font-semibold", r.value < threshold && "text-accent")}>{fmtNum(r.value)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-[1px] border border-ink bg-card">
            <div className={cx("h-full transition-[width] duration-700", r.value < threshold ? "bg-accent" : "bg-ink")} style={{ width: `${Math.max(0, Math.min(100, r.value))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Stacked composition bar (e.g. correct / incorrect / unanswered). */
export function StackBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-[2px] border-[1.5px] border-ink bg-card" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(", ")}>
        {parts.map((p) => (p.value > 0 ? <span key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cx("inline-block h-2.5 w-2.5 border border-ink", p.className)} aria-hidden />
            {p.label} <span className="num font-semibold">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
