"use client";

import { type User, sendEmailVerification } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { type ProfileFields, ProfileFieldset, safeNext, validateProfile } from "@/components/auth-forms";
import { useAuth } from "@/components/auth-provider";
import { NotConfigured } from "@/components/guards";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { fmtDateTime } from "@/lib/format-utils";
import type { Profile } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const { configured, loading, user, profile } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("keyin"));

  useEffect(() => {
    if (!loading && !user) router.replace("/kirish?keyin=/kabinet/profil");
  }, [loading, user, router]);

  if (!configured) return <NotConfigured />;
  if (loading || !user) return <PageLoader />;
  // Re-mount the form when a profile first appears so its initial values come from it.
  return <ProfileForm key={profile ? profile.uid : "new"} user={user} profile={profile} next={next} />;
}

function initialFields(profile: Profile | null, user: User): ProfileFields {
  if (profile)
    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? "",
      region: profile.region ?? "",
      institution: profile.institution ?? "",
      grade: profile.grade ?? "",
    };
  const [f = "", ...rest] = (user.displayName ?? "").split(" ");
  return { firstName: f, lastName: rest.join(" "), phone: "", region: "", institution: "", grade: "" };
}

function ProfileForm({ user, profile, next }: { user: User; profile: Profile | null; next: string }) {
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const [v, setV] = useState<ProfileFields>(() => initialFields(profile, user));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [verifySent, setVerifySent] = useState(false);
  const creating = !profile;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve = validateProfile(v);
    setErrors(ve);
    if (Object.keys(ve).length) return;
    setBusy(true);
    setMsg(null);
    try {
      await api<{ profile: Profile }>("/api/me", { method: creating ? "POST" : "PATCH", body: v });
      if (creating) {
        await refreshProfile();
        router.replace(next);
      } else {
        setMsg({ tone: "ok", text: "Profil saqlandi." });
        await refreshProfile();
      }
    } catch (err) {
      setMsg({ tone: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">{creating ? "So‘nggi qadam" : "Shaxsiy kabinet"}</p>
      <h1 className="display mt-2 text-5xl">{creating ? "Profilni to‘ldiring" : "Profil"}</h1>
      {creating && <p className="mt-3 text-ink-2">Candidate ID profil saqlangach avtomatik beriladi.</p>}

      {profile && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="sheet p-4">
            <p className="eyebrow">Candidate ID</p>
            <p className="num mt-1 text-xl font-semibold tracking-wider">{profile.candidateId}</p>
          </div>
          <div className="sheet p-4">
            <p className="eyebrow">Email</p>
            <p className="mt-1 truncate text-sm font-medium">{profile.email}</p>
            <p className={`mt-1 text-xs ${user.emailVerified ? "text-ok" : "text-warn"}`}>{user.emailVerified ? "✓ tasdiqlangan" : "! tasdiqlanmagan"}</p>
          </div>
          <div className="sheet p-4">
            <p className="eyebrow">Ro‘yxatdan o‘tgan</p>
            <p className="num mt-1 text-sm">{fmtDateTime(profile.createdAt)}</p>
          </div>
        </div>
      )}

      {!user.emailVerified && (
        <Alert tone="warn" className="mt-6" title="Email manzilingiz tasdiqlanmagan">
          Pochtangizdagi havolani bosing.{" "}
          <button
            type="button"
            className="link font-semibold"
            disabled={verifySent}
            onClick={async () => {
              try {
                await sendEmailVerification(user);
                setVerifySent(true);
              } catch {
                setMsg({ tone: "error", text: "Xatni hozir yuborib bo‘lmadi. Birozdan so‘ng urinib ko‘ring." });
              }
            }}
          >
            {verifySent ? "Xat yuborildi" : "Qayta yuborish"}
          </button>
        </Alert>
      )}

      <form onSubmit={save} noValidate className="sheet-hard mt-8 space-y-6 p-6 sm:p-8">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <ProfileFieldset v={v} set={(p) => setV((o) => ({ ...o, ...p }))} errors={errors} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!creating ? (
            <Link href="/kabinet" className="link text-sm">
              ← Kabinetga qaytish
            </Link>
          ) : (
            <span />
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} {creating ? "Saqlash va davom etish" : "O‘zgarishlarni saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
