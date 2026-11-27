/**
 * Animated SVG illustrations for the intro page. Colours are theme tokens, so every
 * illustration re-colours itself with the active site design.
 */
const INK = "var(--color-ink)";
const ACC = "var(--color-accent)";
const CARD = "var(--color-card)";
const PAPER = "var(--color-paper-2)";
const HAIR = "var(--color-hair)";
const OK = "var(--color-ok)";
const INFO = "var(--color-info)";
const WARN = "var(--color-warn)";

/** Graduation cap with a swinging tassel — the hero's centrepiece. */
export function CapArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} role="img" aria-label="Bitiruv qalpog‘i" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="100" cy="148" rx="60" ry="6" fill={INK} opacity="0.12">
        <animate attributeName="rx" values="60;50;60" dur="5s" repeatCount="indefinite" />
      </ellipse>
      <g className="intro-bob" style={{ "--dur": "5s" } as React.CSSProperties}>
        <path d="M58 78v26c0 12 19 22 42 22s42-10 42-22V78" fill={CARD} stroke={INK} strokeWidth="3" />
        <path d="M100 40 18 72l82 32 82-32z" fill={INK} stroke={INK} strokeWidth="3" />
        <path d="M100 48 40 72" stroke={CARD} strokeOpacity=".25" strokeWidth="3" />
        <circle cx="100" cy="72" r="5" fill={ACC} />
        <g style={{ transformOrigin: "100px 72px", animation: "intro-swing 3s ease-in-out infinite" }}>
          <path d="M100 72 150 92v30" stroke={ACC} strokeWidth="3" />
          <path d="M144 122h12l-2 18h-8z" fill={ACC} />
        </g>
      </g>
      <style>{`@keyframes intro-swing{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}}`}</style>
    </svg>
  );
}

/** Study desk: laptop with a test on screen, books, plant, steaming tea and a running clock. */
export function DeskScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 300" className={className} role="img" aria-label="Talaba stoli: noutbukda test, kitoblar, choy va soat" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* wall clock */}
      <g transform="translate(330 58)">
        <circle r="30" fill={CARD} stroke={INK} strokeWidth="3" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="0" y1="-24" x2="0" y2={i % 3 === 0 ? "-19" : "-21"} stroke={INK} strokeWidth="2" transform={`rotate(${i * 30})`} />
        ))}
        <line className="intro-hand" style={{ "--dur": "40s", transformOrigin: "0 0" } as React.CSSProperties} x1="0" y1="0" x2="0" y2="-14" stroke={INK} strokeWidth="3.5" />
        <line className="intro-hand" style={{ "--dur": "4s", transformOrigin: "0 0" } as React.CSSProperties} x1="0" y1="3" x2="0" y2="-22" stroke={ACC} strokeWidth="2" />
        <circle r="3" fill={ACC} />
      </g>
      {/* window with moving cloud */}
      <rect x="30" y="24" width="120" height="90" rx="4" fill={PAPER} stroke={INK} strokeWidth="3" />
      <path d="M90 24v90M30 69h120" stroke={INK} strokeWidth="2" />
      <g opacity=".75">
        <path d="M40 50a8 8 0 0 1 15-4 9 9 0 0 1 16 4 6 6 0 0 1 0 12H42a6 6 0 0 1-2-12z" fill={CARD} stroke={HAIR} strokeWidth="1.5">
          <animateTransform attributeName="transform" type="translate" values="-10 0;60 0;-10 0" dur="18s" repeatCount="indefinite" />
        </path>
      </g>
      <circle cx="128" cy="44" r="9" fill={WARN} opacity=".85">
        <animate attributeName="r" values="9;11;9" dur="4s" repeatCount="indefinite" />
      </circle>
      {/* desk */}
      <path d="M10 236h400" stroke={INK} strokeWidth="4" />
      <path d="M40 236v56M380 236v56" stroke={INK} strokeWidth="4" />
      {/* laptop */}
      <g>
        <rect x="120" y="120" width="170" height="108" rx="8" fill={INK} />
        <rect x="128" y="128" width="154" height="92" rx="3" fill={CARD} />
        <rect x="128" y="128" width="154" height="12" fill={ACC} opacity=".9" />
        <text x="134" y="137.5" fontSize="7" fill="#fff" fontFamily="var(--font-mono)">MILLIY MOCK · 59:42</text>
        {[0, 1, 2, 3].map((r) => (
          <g key={r} transform={`translate(140 ${152 + r * 16})`}>
            <text x="-6" y="4" fontSize="7" fill={INK} fontFamily="var(--font-mono)">
              {r + 1}
            </text>
            {[0, 1, 2, 3].map((c) => (
              <circle key={c} cx={10 + c * 16} cy="1.5" r="5" stroke={ACC} strokeWidth="1.5" fill={CARD}>
                {c === (r * 3 + 1) % 4 && (
                  <animate attributeName="fill" values={`var(--color-card);var(--color-card);var(--color-ink);var(--color-ink)`} keyTimes="0;0.2;0.3;1" dur="6s" begin={`${r * 0.8}s`} repeatCount="indefinite" />
                )}
              </circle>
            ))}
            <line className="intro-type-line" style={{ "--delay": `${r * 0.5}s` } as React.CSSProperties} x1="84" y1="1.5" x2="136" y2="1.5" stroke={HAIR} strokeWidth="4" />
          </g>
        ))}
        <path d="M100 228h210l-12 10H112z" fill={INK} />
      </g>
      {/* books */}
      <g>
        <rect x="318" y="206" width="78" height="14" rx="2" fill={INFO} stroke={INK} strokeWidth="2.5" />
        <rect x="324" y="192" width="70" height="14" rx="2" fill={ACC} stroke={INK} strokeWidth="2.5" />
        <rect x="314" y="220" width="84" height="16" rx="2" fill={OK} stroke={INK} strokeWidth="2.5" />
        <path d="M330 199h40M326 228h50" stroke={CARD} strokeOpacity=".6" strokeWidth="2" />
        <g className="intro-bob" style={{ "--dur": "4s" } as React.CSSProperties}>
          <path d="M352 176l12-16 6 4-12 16z" fill={WARN} stroke={INK} strokeWidth="2" />
          <path d="M352 176l-2 6 6-2" fill={INK} />
        </g>
      </g>
      {/* plant */}
      <g>
        <path d="M44 236l6-34h32l6 34z" fill={ACC} stroke={INK} strokeWidth="2.5" />
        <g style={{ transformOrigin: "66px 202px", animation: "intro-leaf 4s ease-in-out infinite" }}>
          <path d="M66 202c-2-20-16-30-28-30 2 14 12 26 28 30z" fill={OK} stroke={INK} strokeWidth="2.5" />
          <path d="M66 202c2-26 16-38 30-38-2 18-12 32-30 38z" fill={OK} stroke={INK} strokeWidth="2.5" />
          <path d="M66 202c0-18 4-30 0-44-6 14-4 28 0 44z" fill={OK} stroke={INK} strokeWidth="2.5" />
        </g>
      </g>
      {/* tea */}
      <g>
        <path d="M300 236v-22h26v14a8 8 0 0 1-8 8z" fill={CARD} stroke={INK} strokeWidth="2.5" />
        <path d="M326 218h4a6 6 0 0 1 0 12h-4" stroke={INK} strokeWidth="2.5" />
        {[0, 1, 2].map((i) => (
          <path key={i} className="intro-steam" style={{ animationDelay: `${i * 0.9}s` }} d={`M${305 + i * 7} 208c-4-6 4-10 0-16`} stroke={HAIR} strokeWidth="2.5" />
        ))}
      </g>
      {/* paper plane looping around */}
      <g>
        <path d="M0 0l18 6-18 6 4-6z" fill={CARD} stroke={INK} strokeWidth="1.8">
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path="M20 150 C 80 80, 160 60, 230 100 S 380 160, 400 110 S 300 20, 200 40 S 40 120, 20 150" />
        </path>
      </g>
      <style>{`@keyframes intro-leaf{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}`}</style>
    </svg>
  );
}

/** Rocket lifting off through falling stars. */
export function RocketScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Uchayotgan raketa" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="100" cy="100" r="92" fill={PAPER} stroke={INK} strokeWidth="3" />
      <clipPath id="rk-clip">
        <circle cx="100" cy="100" r="90" />
      </clipPath>
      <g clipPath="url(#rk-clip)">
        {[20, 60, 140, 170, 95, 40, 120].map((x, i) => (
          <circle key={i} cx={x} cy={10 + (i * 23) % 60} r={i % 2 ? 2 : 3} fill={i % 3 ? INK : ACC} className="intro-star" style={{ "--delay": `${i * 0.35}s` } as React.CSSProperties} />
        ))}
        <path d="M0 170c30-10 50 6 80-2s50-16 120 0v40H0z" fill={HAIR} />
      </g>
      <g className="intro-rocket">
        <g transform="translate(100 104) rotate(35)">
          <path className="intro-flame" d="M-9 34c2 14 6 22 9 30 3-8 7-16 9-30z" fill={WARN} />
          <path className="intro-flame" style={{ animationDelay: ".09s" }} d="M-5 34c1 9 3 14 5 20 2-6 4-11 5-20z" fill={ACC} />
          <path d="M0-50c18 16 22 46 14 84h-28c-8-38-4-68 14-84z" fill={CARD} stroke={INK} strokeWidth="3" />
          <path d="M-14 14-28 34l14-2zM14 14l14 20-14-2z" fill={ACC} stroke={INK} strokeWidth="3" />
          <circle cy="-8" r="9" fill={INFO} stroke={INK} strokeWidth="3" />
          <path d="M-9-34c6-4 12-4 18 0" stroke={ACC} strokeWidth="4" />
        </g>
      </g>
    </svg>
  );
}

/** Trophy with a pulsing glow and sparkles. */
export function TrophyScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Kubok" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="100" cy="92" r="70" fill={ACC} opacity=".12">
        <animate attributeName="r" values="60;78;60" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values=".18;.05;.18" dur="3s" repeatCount="indefinite" />
      </circle>
      <g className="intro-bob" style={{ "--dur": "4s" } as React.CSSProperties}>
        <path d="M64 40h72v30c0 22-16 40-36 40S64 92 64 70z" fill={WARN} stroke={INK} strokeWidth="3" />
        <path d="M64 50H46c0 22 10 32 22 34M136 50h18c0 22-10 32-22 34" stroke={INK} strokeWidth="3" />
        <path d="M100 110v22M78 150h44l-6-18H84z" stroke={INK} strokeWidth="3" fill={CARD} />
        <rect x="70" y="150" width="60" height="14" rx="2" fill={INK} />
        <path d="M100 54l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill={CARD} stroke={INK} strokeWidth="2" />
        <path d="M76 46c0 14 2 26 8 34" stroke={CARD} strokeOpacity=".7" strokeWidth="4" />
      </g>
      {[
        [40, 40, 0],
        [162, 34, 0.6],
        [170, 120, 1.2],
        [30, 130, 1.8],
      ].map(([x, y, d], i) => (
        <path key={i} d={`M${x} ${y - 8}v16M${x - 8} ${y}h16`} stroke={i % 2 ? ACC : INK} strokeWidth="3">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin={`${d}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" values={`0 ${x} ${y};90 ${x} ${y}`} dur="2.4s" begin={`${d}s`} repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

/** Small round subject badges used on the hero orbits. */
export function OrbitBadge({ glyph, label, tone = "ink" }: { glyph: string; label: string; tone?: "ink" | "accent" }) {
  return (
    <span
      title={label}
      className={`-ml-7 -mt-7 grid h-14 w-14 place-items-center rounded-full border-[1.5px] text-lg font-semibold shadow-lg ${tone === "accent" ? "border-accent bg-accent text-white" : "border-ink bg-card text-ink"}`}
    >
      {glyph}
    </span>
  );
}
