"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { cx } from "@/lib/format-utils";

const NAV = [
  { href: "/admin", label: "Boshqaruv paneli", code: "00" },
  { href: "/admin/materiallar", label: "Test materiallari", code: "01" },
  { href: "/admin/materiallar/yangi", label: "HTML yuklash", code: "02" },
  { href: "/admin/natijalar", label: "Natijalar va tekshiruv", code: "03" },
  { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar", code: "04" },
  { href: "/admin/formatlar", label: "Fanlar va formatlar", code: "05" },
  { href: "/admin/jurnal", label: "Audit jurnali", code: "06" },
  { href: "/admin/dizayn", label: "Sayt dizayni", code: "07" },
  { href: "/admin/tolovlar", label: "To‘lovlar", code: "08" },
  { href: "/admin/agent", label: "AI agent", code: "09" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  if (pathname === href) return true;
  // Prefer the most specific nav entry (e.g. ".../yangi" over ".../materiallar").
  return pathname.startsWith(href + "/") && !NAV.some((n) => n.href !== href && n.href.startsWith(href) && pathname.startsWith(n.href));
}

function AdminNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Admin menyusi" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {NAV.map((n) => {
        const on = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={cx("flex shrink-0 items-center gap-3 rounded-[2px] px-3 py-2 text-sm transition-colors", on ? "bg-paper text-ink" : "text-paper/80 hover:bg-paper/10 hover:text-paper")}
          >
            <span className={cx("num text-[0.65rem]", on ? "text-accent" : "text-paper/40")}>{n.code}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminNavWithPath() {
  return <AdminNav pathname={usePathname()} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [out, setOut] = useState(false);
  const logout = async () => {
    setOut(true);
    await api("/api/admin/logout", { method: "POST", auth: false }).catch(() => undefined);
    router.replace("/admin/kirish");
    router.refresh();
  };
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 border-b-[1.5px] border-ink bg-ink text-paper lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r-[1.5px]">
        <div className="flex items-center justify-between px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" className="text-sm [&_*]:!text-paper [&_.ring-ink]:ring-paper">
            <Logo />
          </Link>
          <p className="hidden font-mono text-[0.62rem] uppercase tracking-[0.16em] text-paper/50 lg:mt-2 lg:block">Boshqaruv paneli</p>
          <button
            type="button"
            className="btn btn-sm !border-paper/40 !bg-transparent !text-paper !shadow-none lg:hidden"
            disabled={out}
            onClick={logout}
          >
            Chiqish
          </button>
        </div>
        <Suspense fallback={<AdminNav pathname={null} />}>
          <AdminNavWithPath />
        </Suspense>
        <div className="absolute bottom-0 hidden w-64 border-t border-paper/15 p-4 lg:block">
          <Link href="/" className="block font-mono text-xs text-paper/60 hover:text-paper">
            ← Saytga qaytish
          </Link>
          <button
            type="button"
            className="btn btn-sm mt-3 w-full !border-paper/40 !bg-transparent !text-paper !shadow-none hover:!bg-paper/10"
            disabled={out}
            onClick={logout}
          >
            {out && <Spinner />} Chiqish
          </button>
        </div>
      </aside>
      <main id="asosiy" className="min-w-0 flex-1 px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
