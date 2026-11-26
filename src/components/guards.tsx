"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { Alert, PageLoader } from "./ui";
import type { Profile } from "@/lib/types";

export function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Alert tone="warn" title="Firebase hali ulanmagan">
        Platforma ishlashi uchun administrator <code className="font-mono">.env.local</code> faylida Firebase kalitlarini ko‘rsatishi kerak. Batafsil
        yo‘riqnoma README faylida.
      </Alert>
    </div>
  );
}

/**
 * Renders children only for a signed-in candidate with a provisioned profile.
 * Redirects to sign-in, or to profile completion, otherwise.
 */
export function RequireCandidate({ children }: { children: (profile: Profile) => React.ReactNode }) {
  const { configured, loading, user, profile, profileError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!configured || loading) return;
    const here = window.location.pathname;
    if (!user) router.replace(`/kirish?keyin=${encodeURIComponent(here)}`);
    else if (!profile && !profileError) router.replace(`/kabinet/profil?keyin=${encodeURIComponent(here)}`);
  }, [configured, loading, user, profile, profileError, router]);

  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoader />;
  if (profileError)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="Profilni yuklab bo‘lmadi">
          {profileError} <Link href="/">Bosh sahifaga qaytish</Link>
        </Alert>
      </div>
    );
  if (!user || !profile) return <PageLoader label="Yo‘naltirilmoqda…" />;
  if (profile.status !== "active")
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="Hisob bloklangan">
          Hisobingiz vaqtincha to‘xtatilgan. Administrator bilan bog‘laning.
        </Alert>
      </div>
    );
  return <>{children(profile)}</>;
}
