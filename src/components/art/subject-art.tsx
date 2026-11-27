/**
 * Animated, on-brand SVG illustrations for each subject (no external images).
 * Colours come from the design tokens; all motion stops under prefers-reduced-motion.
 */

const INK = "var(--color-ink)";
const ACCENT = "var(--color-accent)";
const HAIR = "var(--color-hair)";

function Frame({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" role="img" aria-label={label} className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* faint graph-paper */}
      <defs>
        <pattern id="gp" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" stroke={HAIR} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="160" height="120" fill="url(#gp)" opacity="0.6" />
      {children}
    </svg>
  );
}

/** DNA double helix whose rungs flip to fake a 3-D rotation. */
export function BiologyArt({ className }: { className?: string }) {
  const rungs = Array.from({ length: 11 }, (_, i) => i);
  return (
    <Frame label="DNK spirali" className={className}>
      {rungs.map((i) => {
        const y = 12 + i * 9.6;
        // Equal rungs; the staggered flip animation alone produces the twisting helix shape.
        const w = 34;
        return (
          <g key={i} style={{ transformBox: "fill-box", transformOrigin: "center", animation: `helix 3.2s ease-in-out ${-i * 0.29}s infinite` }}>
            <line x1={80 - w} y1={y} x2={80 + w} y2={y} stroke={i % 3 === 0 ? ACCENT : INK} strokeWidth="2" />
            <circle cx={80 - w} cy={y} r="3.2" fill={INK} />
            <circle cx={80 + w} cy={y} r="3.2" fill={ACCENT} />
          </g>
        );
      })}
    </Frame>
  );
}

/** Benzene ring with orbiting electrons and rising bubbles. */
export function ChemistryArt({ className }: { className?: string }) {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(80 + 30 * Math.cos(a)).toFixed(1)},${(60 + 30 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <Frame label="Benzol halqasi" className={className}>
      <polygon points={hex} stroke={INK} strokeWidth="2.5" />
      <circle cx="80" cy="60" r="17" stroke={ACCENT} strokeWidth="2" strokeDasharray="4 4" className="spin-slow" />
      <g className="spin-slow" style={{ animationDuration: "7s" }}>
        <ellipse cx="80" cy="60" rx="52" ry="20" stroke={INK} strokeWidth="1" opacity="0.35" />
        <circle cx="132" cy="60" r="4" fill={ACCENT} />
        <circle cx="28" cy="60" r="3" fill={INK} />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={20 + i * 8} cy="105" r={2 + i} stroke={INK} strokeWidth="1.2">
          <animate attributeName="cy" values="110;14" dur={`${3 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur={`${3 + i}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </Frame>
  );
}

/** Axes with a sine curve that draws itself and a point tracing it. */
export function MathArt({ className }: { className?: string }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = 14 + i * 3.3;
    return `${x.toFixed(1)},${(62 - 28 * Math.sin((i / 40) * Math.PI * 2.5)).toFixed(1)}`;
  });
  const d = `M${pts.join(" L")}`;
  return (
    <Frame label="Funksiya grafigi" className={className}>
      <line x1="10" y1="62" x2="152" y2="62" stroke={INK} strokeWidth="1.5" />
      <line x1="20" y1="110" x2="20" y2="8" stroke={INK} strokeWidth="1.5" />
      <path d="M148 58 L152 62 L148 66 M16 12 L20 8 L24 12" stroke={INK} strokeWidth="1.5" />
      <path d={d} stroke={ACCENT} strokeWidth="2.5" strokeDasharray="420" strokeDashoffset="420">
        <animate attributeName="stroke-dashoffset" values="420;0;0;420" keyTimes="0;0.45;0.8;1" dur="6s" repeatCount="indefinite" />
      </path>
      <circle r="4" fill={INK}>
        <animateMotion path={d} dur="6s" keyPoints="0;1;1;0" keyTimes="0;0.45;0.8;1" calcMode="linear" repeatCount="indefinite" />
      </circle>
      <text x="118" y="24" fill={INK} fontFamily="var(--font-serif)" fontStyle="italic" fontSize="15">
        f(x)
      </text>
    </Frame>
  );
}

/** Atom: nucleus with three tilted orbits and electrons moving along them. */
export function PhysicsArt({ className }: { className?: string }) {
  const orbit = "M 30 60 A 50 18 0 1 1 130 60 A 50 18 0 1 1 30 60";
  return (
    <Frame label="Atom modeli" className={className}>
      {[0, 60, 120].map((rot, i) => (
        <g key={rot} transform={`rotate(${rot} 80 60)`}>
          <path d={orbit} stroke={INK} strokeWidth="1.4" opacity="0.8" />
          <circle r="3.6" fill={i === 1 ? INK : ACCENT}>
            <animateMotion path={orbit} dur={`${2.6 + i * 0.7}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <circle cx="80" cy="60" r="8" fill={ACCENT} />
      <circle cx="80" cy="60" r="8" stroke={ACCENT} strokeWidth="1.5" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "pulse-ring 2.4s ease-out infinite" }} />
    </Frame>
  );
}

const MAP: Record<string, (p: { className?: string }) => React.ReactElement> = {
  biologiya: BiologyArt,
  kimyo: ChemistryArt,
  matematika: MathArt,
  fizika: PhysicsArt,
};

/** Picks the illustration for a subject code; new subjects get a neutral bubble motif. */
export function SubjectArt({ code, className }: { code: string; className?: string }) {
  const Art = MAP[code];
  if (Art) return <Art className={className} />;
  return (
    <Frame label="Fan" className={className}>
      {["A", "B", "C", "D"].map((l, i) => (
        <g key={l}>
          <circle cx={35 + i * 30} cy="60" r="11" stroke={ACCENT} strokeWidth="1.5" />
          <circle cx={35 + i * 30} cy="60" r="11" fill={INK} opacity="0">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.7;1" dur="4s" begin={`${i}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </Frame>
  );
}
