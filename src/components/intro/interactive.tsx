"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Types, holds, deletes and cycles through words. */
export function Typewriter({ words, className }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState(words[0]);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (reduced()) return;
    const word = words[i % words.length];
    let t: number;
    if (!del && text === word) t = window.setTimeout(() => setDel(true), 1600);
    else if (del && text === "")
      t = window.setTimeout(() => {
        setDel(false);
        setI((x) => x + 1);
      }, 250);
    else t = window.setTimeout(() => setText(del ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1)), del ? 45 : 85);
    return () => window.clearTimeout(t);
  }, [text, del, i, words]);
  return (
    <span className={className}>
      {text}
      <span className="intro-caret" aria-hidden />
    </span>
  );
}

/** Title split into letters that pop in one by one. */
export function LetterTitle({ text, className }: { text: string; className?: string }) {
  let k = 0;
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, wi) => (
        <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
          {[...w].map((ch) => (
            <span key={k} className="intro-letter" style={{ "--i": k++ } as React.CSSProperties}>
              {ch}
            </span>
          ))}
          {" "}
        </span>
      ))}
    </span>
  );
}

/** Children move with the mouse; `depth` sets how much (negative = opposite way). */
export function Parallax({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.querySelectorAll<HTMLElement>("[data-depth]").forEach((n) => {
          const d = Number(n.dataset.depth);
          n.style.transform = `translate3d(${x * d}px, ${y * d}px, 0)`;
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** 3-D tilt toward the pointer with a moving shine. */
export function Tilt({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 12}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} className={`intro-tilt ${className ?? ""}`} style={style} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}

/** Sets --p (0…1) on itself as the element scrolls through the viewport. */
export function ScrollProgress({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      el.style.setProperty("--p", "1");
      return;
    }
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / r.height));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

const CONFETTI = ["var(--color-accent)", "var(--color-info)", "var(--color-ok)", "var(--color-warn)", "var(--color-ink)"];

function burst(x: number, y: number) {
  if (reduced()) return;
  for (let i = 0; i < 46; i++) {
    const s = document.createElement("span");
    s.className = "intro-confetti";
    const ang = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 220;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.background = CONFETTI[i % CONFETTI.length];
    s.style.setProperty("--x", `${Math.cos(ang) * dist}px`);
    s.style.setProperty("--y", `${Math.sin(ang) * dist + 120}px`);
    s.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    document.body.appendChild(s);
    window.setTimeout(() => s.remove(), 1400);
  }
}

/** Link that bursts confetti from the pointer before navigating. */
export function ConfettiLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={className}
      onPointerEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
      }}
    >
      {children}
    </Link>
  );
}

/** Counts up when visible. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}

/** Circular progress that fills when scrolled into view. */
export function Ring({ value, label, sub, delay = 0 }: { value: number; label: string; sub: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const C = 2 * Math.PI * 44;
  return (
    <div ref={ref} className="flex flex-col items-center text-center">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-hair)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={inView ? C * (1 - value / 100) : C}
          className="intro-ring"
          style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
        />
      </svg>
      <p className="num -mt-[5.4rem] mb-12 text-3xl font-semibold">{label}</p>
      <p className="text-sm text-muted">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ live answer-sheet demo */

const DEMO = [
  { n: 1, pick: 1, ok: true },
  { n: 2, pick: 3, ok: true },
  { n: 3, pick: 0, ok: false, right: 2 },
  { n: 4, pick: 2, ok: true },
  { n: 5, pick: 1, ok: true },
  { n: 6, pick: 3, ok: true },
];

/** A mini answer sheet that fills itself in, then gets checked — on a loop. */
export function DemoSheet() {
  const [step, setStep] = useState(0); // 0..6 filling, 7 checking, 8 hold
  const [secs, setSecs] = useState(59 * 60 + 42);
  const [ref, inView] = useInView<HTMLDivElement>();
  useEffect(() => {
    if (!inView) return;
    const still = reduced();
    if (still && step === 8) return;
    const t = window.setTimeout(() => setStep((s) => (still ? 8 : s >= 9 ? 0 : s + 1)), still ? 0 : step === 0 ? 900 : step >= 7 ? 1800 : 650);
    return () => window.clearTimeout(t);
  }, [step, inView]);
  useEffect(() => {
    if (!inView || reduced()) return;
    const t = window.setInterval(() => setSecs((s) => (s <= 0 ? 3600 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [inView]);
  const checked = step >= 7;
  const score = checked ? DEMO.filter((d) => d.ok).length : 0;
  return (
    <div ref={ref} className="sheet-hard crop p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Javoblar varaqasi</p>
        <span className="num chip chip-accent">
          ⏱ {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {DEMO.map((d, i) => {
          const filled = step > i;
          return (
            <li key={d.n} className="flex items-center gap-3">
              <span className="num w-5 text-sm text-muted">{d.n}</span>
              {["A", "B", "C", "D"].map((L, j) => {
                const on = filled && d.pick === j;
                const right = checked && !d.ok && d.right === j;
                return (
                  <span
                    key={L}
                    className="bubble bubble-sm"
                    data-filled={on || undefined}
                    style={
                      on && checked
                        ? { background: d.ok ? "var(--color-ok)" : "var(--color-accent)", borderColor: "transparent", color: "#fff" }
                        : right
                          ? { boxShadow: "0 0 0 3px var(--color-ok-soft)", borderColor: "var(--color-ok)", color: "var(--color-ok)" }
                          : undefined
                    }
                  >
                    <span className={on ? "intro-fill" : undefined}>{L}</span>
                  </span>
                );
              })}
              {checked && (
                <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5" fill="none" strokeWidth="3" strokeLinecap="round" stroke={d.ok ? "var(--color-ok)" : "var(--color-accent)"}>
                  <path className="intro-check" d={d.ok ? "M4 12l5 5L20 6" : "M6 6l12 12M18 6L6 18"} />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-5 border-t border-hair pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{checked ? "Tekshirildi" : step > 0 ? "Javoblar avtomatik saqlanmoqda…" : "Imtihon boshlanmoqda…"}</span>
          <span className="num text-2xl font-semibold">
            {score}/{DEMO.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
          <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${(Math.min(step, 6) / 6) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
