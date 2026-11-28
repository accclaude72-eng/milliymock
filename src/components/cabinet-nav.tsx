"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format-utils";

const ITEMS = [
  { href: "/kabinet", label: "Umumiy", icon: "◧" },
  { href: "/kabinet/tahlil", label: "Tahlil", icon: "↗" },
  { href: "/kabinet/xatolar", label: "Xatolar daftari", icon: "✎" },
  { href: "/kabinet/mashq", label: "Mashq", icon: "◎" },
  { href: "/kabinet/reja", label: "O‘quv reja", icon: "▦" },
  { href: "/kartalar", label: "Flashcards", icon: "❏" },
  { href: "/videolar", label: "Video darslar", icon: "►" },
  { href: "/challenge", label: "Challenge", icon: "⚡" },
  { href: "/reyting", label: "Reyting", icon: "🏆" },
  { href: "/battle", label: "Battle", icon: "⚔" },
  { href: "/dostlar", label: "Do‘stlar", icon: "☺" },
  { href: "/xonalar", label: "Xonalar", icon: "▣" },
  { href: "/imtihonlar", label: "Mock imtihonlar", icon: "▶" },
  { href: "/kabinet/sertifikatlar", label: "Sertifikatlar", icon: "🎓" },
  { href: "/kabinet/bildirishnomalar", label: "Bildirishnomalar", icon: "🔔" },
  { href: "/kabinet/profil", label: "Sozlamalar", icon: "⚙" },
];

/** Student area navigation — horizontal and scrollable on phones, a row of tabs on desktop. */
export function CabinetNav() {
  const path = usePathname();
  return (
    <nav aria-label="Kabinet bo‘limlari" className="no-scrollbar -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-hair px-4 sm:mx-0 sm:px-0">
      {ITEMS.map((i) => {
        const on = i.href === "/kabinet" ? path === "/kabinet" : path?.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            // 16 tabs on every cabinet page: prefetching all of them would compete with the page's own data requests.
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <span aria-hidden className="text-xs">
              {i.icon}
            </span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
