"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { Logo } from "./ui";
import { cx } from "@/lib/format-utils";

const NAV = [
  { href: "/intro", label: "Tanishuv ✦" },
  { href: "/imtihonlar", label: "Imtihonlar" },
  { href: "/fanlar", label: "Fanlar" },
  { href: "/challenge", label: "Challenge ⚡" },
  { href: "/battle", label: "Battle ⚔" },
  { href: "/reyting", label: "Reyting" },
  { href: "/#jarayon", label: "Qanday ishlaydi" },
  { href: "/#savollar", label: "Savollar" },
];

function DesktopNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Asosiy menyu" className="hidden flex-1 items-center gap-1 xl:flex">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cx(
            "whitespace-nowrap rounded-[2px] px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink",
            pathname === n.href && "bg-paper-2 text-ink",
          )}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Reads the URL, so it must stream behind a Suspense boundary (Cache Components). */
function DesktopNavWithPath() {
  return <DesktopNav pathname={usePathname()} />;
}

export function SiteHeader() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const authed = !!user;
  const doSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-paper/95 backdrop-blur-sm no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-[1.05rem]" aria-label="Milliy Mock — bosh sahifa">
          <Logo />
        </Link>
        <Suspense fallback={<DesktopNav pathname={null} />}>
          <DesktopNavWithPath />
        </Suspense>
        <div className="ml-auto hidden items-center gap-2 xl:flex">
          {loading ? (
            <span className="skeleton h-9 w-40" />
          ) : authed ? (
            <>
              <Link href="/kabinet" className="btn btn-sm">
                <span className="num text-xs text-muted">{profile?.candidateId ?? "Kabinet"}</span>
                <span>Kabinet</span>
              </Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={doSignOut}>
                Chiqish
              </button>
            </>
          ) : (
            <>
              <Link href="/kirish" className="btn btn-ghost btn-sm">
                Kirish
              </Link>
              <Link href="/royxatdan-otish" className="btn btn-primary btn-sm">
                Ro‘yxatdan o‘tish
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn-sm ml-auto xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Yopish" : "Menyu"}
        </button>
      </div>
      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t-[1.5px] border-ink bg-paper animate-fade xl:hidden"
          onClick={(e) => {
            // Close the menu after any link/button inside it is activated.
            if ((e.target as HTMLElement).closest("a,button")) setOpen(false);
          }}
        >
          <nav aria-label="Mobil menyu" className="flex flex-col px-4 py-4">
            {NAV.map((n, i) => (
              <Link key={n.href} href={n.href} className="flex items-baseline gap-4 border-b border-hair py-4">
                <span className="num text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="display text-3xl">{n.label}</span>
              </Link>
            ))}
            <div className="mt-6 grid gap-2">
              {authed ? (
                <>
                  <Link href="/kabinet" className="btn btn-ink">
                    Shaxsiy kabinet
                  </Link>
                  <button type="button" className="btn" onClick={doSignOut}>
                    Chiqish
                  </button>
                </>
              ) : (
                <>
                  <Link href="/royxatdan-otish" className="btn btn-primary">
                    Ro‘yxatdan o‘tish
                  </Link>
                  <Link href="/kirish" className="btn">
                    Kirish
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
