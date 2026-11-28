"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InstallButton } from "@/components/pwa";
import { api } from "@/lib/api";
import { cx } from "@/lib/format-utils";

interface Today {
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

function Tile({ href, icon, title, value, hint, hot }: { href: string; icon: string; title: string; value: React.ReactNode; hint: string; hot?: boolean }) {
  return (
    <Link href={href} className={cx("sheet group flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-hard", hot && "border-accent")}>
      <span className="flex items-center justify-between">
        <span className="eyebrow">{title}</span>
        <span aria-hidden className="text-lg">
          {icon}
        </span>
      </span>
      <span className={cx("num mt-2 whitespace-nowrap text-2xl font-semibold sm:text-3xl", hot && "text-accent")}>{value}</span>
      <span className="mt-auto pt-1 text-xs text-muted">{hint}</span>
    </Link>
  );
}

/** "Bugun" — what to do today, from one aggregated request. */
export function TodayPanel() {
  const [d, setD] = useState<Today | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<Today>("/api/me/dashboard")
      .then(setD)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!d)
    return (
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );

  const ch = d.challenges.find((c) => !c.done) ?? d.challenges[0];
  const planLeft = d.plan.total - d.plan.done;
  return (
    <section className="mt-8" aria-label="Bugun">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-3xl">Bugun</h2>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="chip chip-warn">🔥 {d.streak} kun streak</span>
          <span className="chip chip-ink num">
            {d.xp.total} XP · +{d.xp.week} shu hafta
          </span>
          <InstallButton />
        </span>
      </div>

      {d.battleInvites > 0 && (
        <Link href="/battle" className="mt-4 flex items-center justify-between gap-3 border-[1.5px] border-accent bg-accent-soft px-4 py-3 text-sm">
          <span>
            ⚔ <b>{d.battleInvites} ta battle taklifi</b> sizni kutmoqda
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          href="/challenge"
          icon="⚡"
          title="Challenge"
          value={!ch ? "—" : ch.done ? "✓" : `${ch.questions} savol`}
          hint={!ch ? "Bugun challenge yo‘q" : ch.done ? "Bugungisi topshirildi" : `${ch.minutes} daqiqa · XP oling`}
          hot={!!ch && !ch.done}
        />
        <Tile
          href="/kabinet/reja"
          icon="▦"
          title="O‘quv reja"
          value={d.plan.total ? `${d.plan.done}/${d.plan.total}` : "—"}
          hint={d.plan.total ? (planLeft ? (d.plan.next[0]?.title ?? "") : "Bugungi vazifalar bajarildi") : "Reja tuzing"}
          hot={planLeft > 0}
        />
        <Tile
          href={d.mistakesDue ? "/kabinet/mashq?mode=mistakes&due=1&count=20" : "/kabinet/xatolar"}
          icon="✎"
          title="Xatolarni takrorlash"
          value={d.mistakesDue}
          hint={d.mistakesDue ? "Takrorlash vaqti keldi" : d.mistakesOpen ? `${d.mistakesOpen} ta ochiq xato — navbati keyinroq` : "Hozircha yo‘q"}
          hot={d.mistakesDue > 0}
        />
        <Tile href="/kartalar" icon="❏" title="Flashcards" value={d.cardsDue} hint={d.cardsDue ? "Bugun takrorlanadigan" : "Yangi kartalarni o‘rganing"} hot={d.cardsDue > 0} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href="/battle" className="btn btn-sm">
          ⚔ Battle
        </Link>
        <Link href="/xonalar" className="btn btn-sm">
          ▣ Xonalar{d.rooms ? ` · ${d.rooms}` : ""}
        </Link>
        <Link href="/videolar" className="btn btn-sm">
          ► Video darslar
        </Link>
        <Link href="/kabinet/sertifikatlar" className="btn btn-sm">
          🎓 Sertifikatlar{d.certificates ? ` · ${d.certificates}` : ""}
        </Link>
        {!d.telegramLinked && (
          <Link href="/kabinet/bildirishnomalar" className="btn btn-sm btn-ghost">
            🔔 Telegramni ulash
          </Link>
        )}
      </div>
    </section>
  );
}
