/**
 * Decorative formulas drifting in the hero background (pure CSS, aria-hidden).
 * Hidden on small screens so text stays readable.
 */
const GLYPHS: { t: string; x: string; y: string; size: string; rot: string; dur: string; delay: string; accent?: boolean }[] = [
  { t: "H₂O", x: "6%", y: "18%", size: "2.1rem", rot: "-8deg", dur: "7s", delay: "0s" },
  { t: "E = mc²", x: "38%", y: "8%", size: "1.6rem", rot: "4deg", dur: "9s", delay: "-2s", accent: true },
  { t: "∫ f(x) dx", x: "3%", y: "78%", size: "1.7rem", rot: "6deg", dur: "8s", delay: "-4s" },
  { t: "ATF", x: "46%", y: "86%", size: "1.4rem", rot: "-5deg", dur: "10s", delay: "-1s" },
  { t: "F = ma", x: "88%", y: "90%", size: "1.5rem", rot: "3deg", dur: "7.5s", delay: "-3s", accent: true },
  { t: "π", x: "93%", y: "6%", size: "2.6rem", rot: "-10deg", dur: "6.5s", delay: "-5s" },
  { t: "Δ", x: "30%", y: "60%", size: "2rem", rot: "8deg", dur: "11s", delay: "-6s" },
  { t: "CH₄", x: "54%", y: "40%", size: "1.3rem", rot: "-4deg", dur: "9.5s", delay: "-2.5s" },
];

export function FloatingGlyphs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none overflow-hidden md:block">
      {GLYPHS.map((g) => (
        <span
          key={g.t}
          className="float-y absolute font-serif italic"
          style={
            {
              left: g.x,
              top: g.y,
              fontSize: g.size,
              "--rot": g.rot,
              animationDuration: g.dur,
              animationDelay: g.delay,
              color: g.accent ? "var(--color-accent)" : "var(--color-ink)",
              opacity: g.accent ? 0.16 : 0.09,
            } as React.CSSProperties
          }
        >
          {g.t}
        </span>
      ))}
    </div>
  );
}
