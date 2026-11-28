"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Stat } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { cx } from "@/lib/format-utils";

interface Overview {
  attention: { key: string; label: string; count: number; href: string }[];
  week: { challengeAttempts: number; battles: number; roomMessages: number; cardReviews: number; videosDone: number; threads: number; practice: number };
  totals: { activeRooms: number; certificates: number; telegram: number; mistakesOpen: number; plans: number };
}

/** Admin home: what needs a decision now, and how the learning modules were used this week. */
export function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => {
    adminApi<Overview>("/api/admin/overview")
      .then(setO)
      .catch(() => setO(null));
  }, []);
  if (!o) return <div className="skeleton mt-8 h-40" />;
  const todo = o.attention.filter((a) => a.count > 0);
  return (
    <>
      <section className="mt-8" aria-label="Diqqat talab qiladi">
        <h2 className="display text-2xl">Diqqat talab qiladi</h2>
        {todo.length === 0 ? (
          <p className="mt-2 text-sm text-ok">✓ Hozir hal qilinishi kerak bo‘lgan ish yo‘q.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {o.attention.map((a) => (
              <li key={a.key}>
                <Link
                  href={a.href}
                  className={cx("flex items-center justify-between gap-3 border-[1.5px] px-4 py-3 text-sm transition-colors hover:bg-paper-2", a.count ? "border-accent" : "border-hair text-muted")}
                >
                  <span>{a.label}</span>
                  <span className={cx("num text-lg font-semibold", a.count > 0 && "text-accent")}>{a.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-label="Haftalik faollik">
        <h2 className="display text-2xl">So‘nggi 7 kun — o‘quv modullari</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Challenge yechildi" value={o.week.challengeAttempts} tone="accent" />
          <Stat label="Battle o‘ynaldi" value={o.week.battles} />
          <Stat label="Flashcard takrorlash" value={o.week.cardReviews} />
          <Stat label="Xatolardan mashq" value={o.week.practice} />
          <Stat label="Ko‘rilgan video dars" value={o.week.videosDone} />
          <Stat label="Yangi muhokama" value={o.week.threads} />
          <Stat label="Xonalardagi xabar" value={o.week.roomMessages} hint={`${o.totals.activeRooms} ta faol xona`} />
          <Stat label="Telegram ulangan" value={o.totals.telegram} tone="ok" hint={`${o.totals.certificates} ta haqiqiy sertifikat`} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Ochiq xatolar: {o.totals.mistakesOpen} · faol o‘quv rejalar: {o.totals.plans}
        </p>
      </section>
    </>
  );
}
