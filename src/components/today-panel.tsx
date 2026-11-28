"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, SkyIcon, StudyScene, TileIcon } from "@/components/dashboard/illustrations";
import { InstallButton } from "@/components/pwa";
import { api } from "@/lib/api";
import { cx } from "@/lib/format-utils";
import { QUOTES, greeting, levelFromXp, levelTitle } from "@/lib/level";
import "./dashboard/dashboard.css";

interface Today {
  week: { day: string; active: boolean }[];
  xp: { total: number; week: number };
  streak: number;
  challenges: { id: string; title: string; questions: number; minutes: number; done: boolean }[];
  plan: { total: number; done: number; next: { title: string; minutes: number | null }[] };
  mistakesDue: number;
  mistakesOpen: number;
  cardsDue: number;
  battleInvites: number;
  rooms: number;
  certificates: number;
  telegramLinked: boolean;
}

const WEEKDAY = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

/** Counts up from 0 (skipped when the visitor prefers reduced motion). */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value <= 0) {
      const t = window.setTimeout(() => setN(value), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{n}</span>;
}

/** Circular progress (0–1) that draws itself in. */
function Ring({ value, size = 92, children }: { value: number; size?: number; children: React.ReactNode }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(Math.max(0, Math.min(1, value))), 120);
    return () => window.clearTimeout(t);
  }, [value]);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hair)" strokeWidth="7" fill="none" />
        <circle
          className="dash-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-accent)"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Tile({
  i,
  href,
  kind,
  title,
  value,
  hint,
  hot,
}: {
  i: number;
  href: string;
  kind: "challenge" | "plan" | "mistakes" | "cards";
  title: string;
  value: React.ReactNode;
  hint: string;
  hot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx("sheet dash-in dash-tile group flex flex-col p-4 transition-all hover:-translate-y-1 hover:shadow-hard", hot && "border-accent")}
      style={{ "--i": i } as React.CSSProperties}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="eyebrow">{title}</span>
        <TileIcon kind={kind} className="dash-tile-icon h-10 w-10 shrink-0" />
      </span>
      <span className={cx("num mt-1 whitespace-nowrap text-2xl font-semibold sm:text-3xl", hot && "text-accent")}>{value}</span>
      <span className="mt-auto pt-1 text-xs text-muted">{hint}</span>
    </Link>
  );
}

/**
 * Student dashboard hero: greeting by time of day, illustration, XP level ring, streak flame,
 * 7-day activity and today's tasks — all from one aggregated request (/api/me/dashboard).
 */
export function TodayPanel({ firstName, candidateId }: { firstName: string; candidateId: string }) {
  const [d, setD] = useState<Today | null>(null);
  const [failed, setFailed] = useState(false);
  const [clock, setClock] = useState<{ hour: number; quote: string } | null>(null);
  useEffect(() => {
    api<Today>("/api/me/dashboard")
      .then(setD)
      .catch(() => setFailed(true));
    // Time-dependent bits are computed after mount (never during render / prerender).
    const t = window.setTimeout(() => {
      const now = Date.now();
      setClock({ hour: new Date(now + 5 * 3600_000).getUTCHours(), quote: QUOTES[Math.floor(now / 86_400_000) % QUOTES.length] });
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const g = clock ? greeting(clock.hour) : null;
  const lv = levelFromXp(d?.xp.total ?? 0);
  const ch = d?.challenges.find((c) => !c.done) ?? d?.challenges[0];
  const planLeft = d ? d.plan.total - d.plan.done : 0;
  const activeDays = d?.week.filter((w) => w.active).length ?? 0;
  const week = d?.week ?? Array.from({ length: 7 }, (_, i) => ({ day: `x${i}`, active: false }));

  return (
    <>
      {/* ═══════════ hero */}
      <section className="sheet-hard dash-hero p-5 sm:p-7" aria-label="Salomlashuv">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="dash-in min-w-0" style={{ "--i": 0 } as React.CSSProperties}>
            <p className="eyebrow flex items-center gap-2">
              {g && <SkyIcon night={g.part === "kech" || g.part === "tun"} className="h-6 w-6" />}
              {g?.text ?? "Salom"} · Shaxsiy kabinet
            </p>
            <h1 className="display mt-2 text-4xl sm:text-6xl">
              Assalomu alaykum, <em>{firstName}</em>
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <span className="chip chip-ink num !text-[0.75rem] !tracking-[0.12em]">{candidateId}</span>
              <Link href="/kabinet/profil" className="link">
                Profilni tahrirlash
              </Link>
              <InstallButton />
            </p>
            {clock && <p className="mt-4 max-w-md text-sm italic text-muted">“{clock.quote}”</p>}

            <div className="mt-6 flex flex-wrap items-center gap-5">
              <Ring value={lv.progress}>
                <span>
                  <span className="num block text-2xl font-semibold leading-none">{lv.level}</span>
                  <span className="text-[0.6rem] uppercase tracking-wider text-muted">daraja</span>
                </span>
              </Ring>
              <div className="min-w-0">
                <p className="font-semibold">{levelTitle(lv.level)}</p>
                <p className="num text-sm text-muted">
                  <CountUp value={d?.xp.total ?? 0} /> XP · keyingi darajagacha {lv.need - lv.into}
                </p>
                <p className="num text-sm text-ok">+{d?.xp.week ?? 0} XP shu hafta</p>
              </div>
              <div className="flex items-center gap-2" title="Ketma-ket challenge kunlari">
                <Flame lit={(d?.streak ?? 0) > 0} className="h-12 w-10" />
                <span>
                  <CountUp value={d?.streak ?? 0} className="num block text-3xl font-semibold leading-none" />
                  <span className="text-xs text-muted">kun streak</span>
                </span>
              </div>
            </div>

            <div className="mt-6">
              <p className="eyebrow">Faollik · 7 kun ({activeDays}/7)</p>
              <ol className="mt-2 flex gap-2" aria-label="So‘nggi 7 kunlik faollik">
                {week.map((w, i) => (
                  <li key={w.day} className="flex flex-col items-center gap-1">
                    <span
                      className={cx("dash-pop grid h-8 w-8 place-items-center rounded-full border-[1.5px] text-xs", w.active ? "border-ok bg-ok text-white" : "border-hair text-muted")}
                      style={{ "--i": i } as React.CSSProperties}
                      aria-label={`${w.day}: ${w.active ? "faol" : "faol emas"}`}
                    >
                      {w.active ? "✓" : ""}
                    </span>
                    <span className="text-[0.65rem] text-muted">{/^\d{4}-/.test(w.day) ? WEEKDAY[new Date(`${w.day}T00:00:00Z`).getUTCDay()] : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="dash-in relative hidden sm:block" style={{ "--i": 1 } as React.CSSProperties}>
            <StudyScene className="mx-auto w-full max-w-md" />
            <Link href="/imtihonlar" className="btn btn-primary absolute bottom-2 right-2 !min-h-11">
              Mock boshlash →
            </Link>
          </div>
          <Link href="/imtihonlar" className="btn btn-primary sm:hidden">
            Mock imtihonni boshlash →
          </Link>
        </div>
      </section>

      {/* ═══════════ today */}
      {!failed && (
        <section className="mt-8" aria-label="Bugun">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-3xl">Bugun</h2>
            {d && d.plan.next[0] && <span className="text-sm text-muted">Keyingi vazifa: {d.plan.next[0].title}</span>}
          </div>

          {d && d.battleInvites > 0 && (
            <Link href="/battle" className="dash-in mt-4 flex items-center justify-between gap-3 border-[1.5px] border-accent bg-accent-soft px-4 py-3 text-sm">
              <span>
                ⚔ <b>{d.battleInvites} ta battle taklifi</b> sizni kutmoqda
              </span>
              <span aria-hidden>→</span>
            </Link>
          )}

          {!d ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton h-32" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile
                i={2}
                href="/challenge"
                kind="challenge"
                title="Challenge"
                value={!ch ? "—" : ch.done ? "✓" : `${ch.questions} savol`}
                hint={!ch ? "Bugun challenge yo‘q" : ch.done ? "Bugungisi topshirildi" : `${ch.minutes} daqiqa · XP oling`}
                hot={!!ch && !ch.done}
              />
              <Tile
                i={3}
                href="/kabinet/reja"
                kind="plan"
                title="O‘quv reja"
                value={d.plan.total ? `${d.plan.done}/${d.plan.total}` : "—"}
                hint={d.plan.total ? (planLeft ? `${planLeft} ta vazifa qoldi` : "Bugungi vazifalar bajarildi") : "Reja tuzing"}
                hot={planLeft > 0}
              />
              <Tile
                i={4}
                href={d.mistakesDue ? "/kabinet/mashq?mode=mistakes&due=1&count=20" : "/kabinet/xatolar"}
                kind="mistakes"
                title="Xatolar"
                value={d.mistakesDue}
                hint={d.mistakesDue ? "Takrorlash vaqti keldi" : d.mistakesOpen ? `${d.mistakesOpen} ta ochiq — navbati keyinroq` : "Hozircha yo‘q"}
                hot={d.mistakesDue > 0}
              />
              <Tile i={5} href="/kartalar" kind="cards" title="Flashcards" value={d.cardsDue} hint={d.cardsDue ? "Bugun takrorlanadigan" : "Yangi kartalarni o‘rganing"} hot={d.cardsDue > 0} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {[
              ["/battle", "⚔ Battle"],
              ["/xonalar", `▣ Xonalar${d?.rooms ? ` · ${d.rooms}` : ""}`],
              ["/videolar", "► Video darslar"],
              ["/reyting", "🏆 Reyting"],
              ["/kabinet/sertifikatlar", `🎓 Sertifikatlar${d?.certificates ? ` · ${d.certificates}` : ""}`],
            ].map(([href, label], i) => (
              <Link key={href} href={href} className="btn btn-sm dash-in" style={{ "--i": 6 + i } as React.CSSProperties}>
                {label}
              </Link>
            ))}
            {d && !d.telegramLinked && (
              <Link href="/kabinet/bildirishnomalar" className="btn btn-sm btn-ghost">
                🔔 Telegramni ulash
              </Link>
            )}
          </div>
        </section>
      )}
    </>
  );
}
