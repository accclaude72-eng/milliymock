/*
 * Hand-drawn style SVG illustrations for the student dashboard. They use the theme's CSS colour
 * tokens (var(--color-…)), so every site design recolours them automatically. Motion lives in
 * dashboard.css and is switched off for visitors who prefer reduced motion.
 */

/** Student at a desk: laptop, book stack, plant, mug and floating formula bubbles. */
export function StudyScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 300" className={className} role="img" aria-label="Kitoblar va noutbuk bilan o‘qiyotgan talaba">
      {/* window glow */}
      <circle cx="320" cy="78" r="58" fill="var(--color-warn)" opacity=".18" className="dash-pulse" />
      {/* floating bubbles */}
      <g className="dash-float" style={{ animationDelay: "-1s" }}>
        <rect x="34" y="30" width="78" height="36" rx="18" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="2" />
        <text x="73" y="54" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-accent)" fontFamily="var(--font-mono)">
          E=mc²
        </text>
      </g>
      <g className="dash-float" style={{ animationDelay: "-3s" }}>
        <rect x="300" y="150" width="86" height="34" rx="17" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="2" />
        <text x="343" y="172" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-info)" fontFamily="var(--font-mono)">
          H₂O · DNK
        </text>
      </g>
      <g className="dash-float" style={{ animationDelay: "-2s" }}>
        <circle cx="140" cy="96" r="16" fill="var(--color-ok)" opacity=".85" />
        <path d="M133 96l5 5 9-10" stroke="var(--color-card)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* sparkles */}
      {[
        [210, 40],
        [380, 110],
        [60, 140],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 9}l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5z`} fill="var(--color-warn)" className="dash-twinkle" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      {/* desk */}
      <rect x="40" y="236" width="340" height="12" rx="4" fill="var(--color-ink)" />
      <rect x="70" y="248" width="10" height="44" fill="var(--color-ink)" />
      <rect x="340" y="248" width="10" height="44" fill="var(--color-ink)" />
      {/* books */}
      <rect x="62" y="214" width="84" height="22" rx="3" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="2" />
      <rect x="70" y="194" width="72" height="20" rx="3" fill="var(--color-info)" stroke="var(--color-ink)" strokeWidth="2" />
      <rect x="66" y="176" width="66" height="18" rx="3" fill="var(--color-warn)" stroke="var(--color-ink)" strokeWidth="2" />
      {/* laptop */}
      <g>
        <rect x="170" y="148" width="130" height="84" rx="8" fill="var(--color-ink)" />
        <rect x="178" y="156" width="114" height="68" rx="4" fill="var(--color-card)" />
        <rect x="188" y="168" width="54" height="7" rx="3.5" fill="var(--color-accent)" className="dash-type" />
        <rect x="188" y="182" width="86" height="6" rx="3" fill="var(--color-hair)" />
        <rect x="188" y="194" width="70" height="6" rx="3" fill="var(--color-hair)" />
        <rect x="188" y="206" width="40" height="6" rx="3" fill="var(--color-ok)" />
        <path d="M156 232h158l-10 6H166z" fill="var(--color-ink)" />
      </g>
      {/* mug with steam */}
      <rect x="318" y="206" width="26" height="30" rx="5" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="2" />
      <path d="M344 214c10 0 10 14 0 14" stroke="var(--color-ink)" strokeWidth="2" fill="none" />
      {[0, 1].map((i) => (
        <path
          key={i}
          d={`M${326 + i * 9} 200c-5-8 5-12 0-20`}
          stroke="var(--color-muted)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          className="dash-steam"
          style={{ animationDelay: `${i * 0.8}s` }}
        />
      ))}
      {/* plant */}
      <path d="M362 236h-26l4-22h18z" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="2" transform="translate(-300 0)" />
      <g className="dash-sway" style={{ transformOrigin: "49px 214px" }}>
        <path d="M49 214c-16-8-20-26-12-36 12 8 14 24 12 36z" fill="var(--color-ok)" />
        <path d="M49 214c14-10 26-14 32-6-8 10-22 10-32 6z" fill="var(--color-ok)" opacity=".8" />
      </g>
    </svg>
  );
}

/** Sun (day) or moon with stars (evening / night). */
export function SkyIcon({ night, className }: { night: boolean; className?: string }) {
  return night ? (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill="var(--color-warn)" />
      {[
        [14, 14],
        [52, 22],
        [10, 44],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="var(--color-ink)" className="dash-twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
    </svg>
  ) : (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g className="dash-spin" style={{ transformOrigin: "32px 32px" }}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="30" y="2" width="4" height="10" rx="2" fill="var(--color-warn)" transform={`rotate(${i * 45} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="13" fill="var(--color-warn)" />
    </svg>
  );
}

/** Flickering streak flame. */
export function Flame({ className, lit }: { className?: string; lit: boolean }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden>
      <g className={lit ? "dash-flicker" : undefined} style={{ transformOrigin: "20px 50px" }}>
        <path d="M20 2c4 10 16 16 16 30a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 9 6 9-2-8 0-16 2-23z" fill={lit ? "var(--color-accent)" : "var(--color-hair)"} />
        <path d="M20 22c2 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 5-9 0 3 2 5 3 5-1-5 0-9 1-13z" fill={lit ? "var(--color-warn)" : "var(--color-paper-2)"} />
      </g>
    </svg>
  );
}

/** Small tile icons. */
export function TileIcon({ kind, className }: { kind: "challenge" | "plan" | "mistakes" | "cards"; className?: string }) {
  const stroke = { stroke: "var(--color-ink)", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="var(--color-accent-soft)" />
      {kind === "challenge" && <path d="M27 8L14 27h9l-2 13 13-19h-9z" fill="var(--color-warn)" {...{ stroke: "var(--color-ink)", strokeWidth: 2.2, strokeLinejoin: "round" }} />}
      {kind === "plan" && (
        <g>
          <rect x="12" y="13" width="24" height="23" rx="3" fill="var(--color-card)" {...stroke} />
          <path d="M12 20h24M18 10v6M30 10v6" fill="none" {...stroke} />
          <path d="M18 28l3 3 7-7" stroke="var(--color-ok)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {kind === "mistakes" && (
        <g>
          <path d="M14 34l18-18 4 4-18 18h-4z" fill="var(--color-warn)" {...stroke} />
          <path d="M28 20l4 4" fill="none" {...stroke} />
          <path d="M12 14l6 6M18 14l-6 6" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}
      {kind === "cards" && (
        <g>
          <rect x="15" y="12" width="20" height="26" rx="3" fill="var(--color-info-soft)" {...stroke} transform="rotate(-10 25 25)" />
          <rect x="15" y="12" width="20" height="26" rx="3" fill="var(--color-card)" {...stroke} transform="rotate(8 25 25)" />
          <path d="M21 22h8M21 27h6" fill="none" {...stroke} transform="rotate(8 25 25)" />
        </g>
      )}
    </svg>
  );
}
