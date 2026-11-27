"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SubjectArt } from "./art/subject-art";
import { useAuth } from "./auth-provider";
import { NotConfigured } from "./guards";
import { Alert, Logo, Spinner } from "./ui";
import { api, errorText } from "@/lib/api";
import { authErrorMessage, siteUrl, supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export const REGIONS = [
  "Qoraqalpog‘iston Respublikasi",
  "Andijon viloyati",
  "Buxoro viloyati",
  "Farg‘ona viloyati",
  "Jizzax viloyati",
  "Xorazm viloyati",
  "Namangan viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Samarqand viloyati",
  "Sirdaryo viloyati",
  "Surxondaryo viloyati",
  "Toshkent viloyati",
  "Toshkent shahri",
];

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

/** Only allow same-site relative redirects. */
export function safeNext(v: string | null, fallback = "/kabinet"): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-20">
      <div className="hidden lg:block">
        <p className="eyebrow">Milliy Mock</p>
        <h1 className="display mt-4 text-6xl">{title}</h1>
        {subtitle && <div className="mt-5 max-w-md text-lg text-ink-2">{subtitle}</div>}
        {aside}
        {/* Four subjects, gently tilted like cards on a desk */}
        <div aria-hidden className="mt-10 grid max-w-md grid-cols-2 gap-3">
          {["biologiya", "kimyo", "matematika", "fizika"].map((c, i) => (
            <div
              key={c}
              className="float-y overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-card shadow-hard-sm"
              style={{ "--rot": `${[-2, 1.5, 1, -1.5][i]}deg`, animationDuration: `${6 + i}s`, animationDelay: `${i * -1.3}s` } as React.CSSProperties}
            >
              <SubjectArt code={c} className="block h-auto w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="crop sheet-hard p-6 sm:p-8">
        <div className="mb-6 lg:hidden">
          <Logo className="text-sm" />
          <h1 className="display mt-4 text-4xl">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function GoogleButton({ returnTo }: { returnTo: string }) {
  const onDone = () => returnTo;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!GOOGLE_ENABLED) return null;
  return (
    <div className="mt-4">
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="hair flex-1" /> yoki <span className="hair flex-1" />
      </div>
      <button
        type="button"
        className="btn w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          // Full-page redirect to Google; the session is picked up when the user returns.
          const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl(onDone()) } });
          if (error) {
            setErr(authErrorMessage(error));
            setBusy(false);
          }
        }}
      >
        {busy && <Spinner />} Google orqali davom etish
      </button>
      {err && <p className="mt-2 text-sm text-accent-ink">{err}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- sign in */

export function SignInForm() {
  const { configured, user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("keyin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace(profile ? next : `/kabinet/profil?keyin=${encodeURIComponent(next)}`);
  }, [loading, user, profile, next, router]);

  if (!configured) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    // On success the redirect is handled by the effect once the profile is loaded.
    if (error) {
      setErr(authErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Kirish" subtitle="Oxirgi urinishingiz qayerda qolgan bo‘lsa, o‘sha joydan davom etasiz — vaqt va javoblar serverda saqlanadi.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Parol
            </label>
            <Link href="/parolni-tiklash" className="link text-xs">
              Parolni unutdingizmi?
            </Link>
          </div>
          <input id="password" type="password" autoComplete="current-password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !email || !password}>
          {busy && <Spinner />} Kirish
        </button>
      </form>
      <GoogleButton returnTo={next} />
      <p className="mt-6 text-sm text-ink-2">
        Hisobingiz yo‘qmi?{" "}
        <Link href={`/royxatdan-otish${next !== "/kabinet" ? `?keyin=${encodeURIComponent(next)}` : ""}`} className="link font-semibold">
          Ro‘yxatdan o‘ting
        </Link>
      </p>
    </AuthShell>
  );
}

/* ---------------------------------------------------------- profile fields */

export interface ProfileFields {
  firstName: string;
  lastName: string;
  phone: string;
  region: string;
  institution: string;
  grade: string;
}

export function ProfileFieldset({ v, set, errors }: { v: ProfileFields; set: (p: Partial<ProfileFields>) => void; errors: Partial<Record<keyof ProfileFields, string>> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="firstName" label="Ism" error={errors.firstName}>
        <input id="firstName" autoComplete="given-name" className="field" value={v.firstName} aria-invalid={!!errors.firstName} onChange={(e) => set({ firstName: e.target.value })} />
      </Field>
      <Field id="lastName" label="Familiya" error={errors.lastName}>
        <input id="lastName" autoComplete="family-name" className="field" value={v.lastName} aria-invalid={!!errors.lastName} onChange={(e) => set({ lastName: e.target.value })} />
      </Field>
      <Field id="region" label="Hudud">
        <select id="region" className="field" value={v.region} onChange={(e) => set({ region: e.target.value })}>
          <option value="">Tanlang…</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field id="grade" label="Sinf / kurs">
        <select id="grade" className="field" value={v.grade} onChange={(e) => set({ grade: e.target.value })}>
          <option value="">Tanlang…</option>
          {["9-sinf", "10-sinf", "11-sinf", "Akademik litsey", "Kollej / texnikum", "Bitiruvchi", "Talaba", "O‘qituvchi", "Boshqa"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </Field>
      <Field id="institution" label="Ta’lim muassasasi (ixtiyoriy)">
        <input id="institution" className="field" value={v.institution} maxLength={120} onChange={(e) => set({ institution: e.target.value })} />
      </Field>
      <Field id="phone" label="Telefon (ixtiyoriy)" error={errors.phone}>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          className="field num"
          value={v.phone}
          aria-invalid={!!errors.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-accent-ink" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function validateProfile(v: ProfileFields): Partial<Record<keyof ProfileFields, string>> {
  const e: Partial<Record<keyof ProfileFields, string>> = {};
  if (v.firstName.trim().length < 2) e.firstName = "Ismni kiriting (kamida 2 ta harf).";
  if (v.lastName.trim().length < 2) e.lastName = "Familiyani kiriting (kamida 2 ta harf).";
  if (v.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(v.phone.trim())) e.phone = "Telefon raqami noto‘g‘ri.";
  return e;
}

/* ------------------------------------------------------------------ sign up */

export function SignUpForm() {
  const { configured, user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("keyin"));
  const [v, setV] = useState<ProfileFields>({ firstName: "", lastName: "", phone: "", region: "", institution: "", grade: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && profile && !creating) router.replace(next);
  }, [loading, user, profile, next, router, creating]);

  if (!configured) return <NotConfigured />;
  if (confirmSent)
    return (
      <AuthShell title="Emailni tasdiqlang">
        <Alert tone="ok" title="Hisob yaratildi">
          <b>{confirmSent}</b> manziliga tasdiqlash havolasi yuborildi. Havolani bosing — shundan so‘ng tizimga kirasiz va Candidate ID beriladi. “Spam” papkasini ham
          tekshiring.
        </Alert>
        <p className="mt-6 text-sm">
          <Link href="/kirish" className="link font-semibold">
            Kirish sahifasi
          </Link>
        </p>
      </AuthShell>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve: Record<string, string> = { ...validateProfile(v) };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ve.email = "Email manzilini to‘g‘ri kiriting.";
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) ve.password = "Kamida 8 ta belgi, harf va raqam bo‘lsin.";
    if (password !== password2) ve.password2 = "Parollar mos emas.";
    if (!agree) ve.agree = "Davom etish uchun shartlarga rozilik bildiring.";
    setErrors(ve);
    if (Object.keys(ve).length) return;
    setBusy(true);
    setCreating(true);
    setErr(null);
    try {
      // Profile fields travel in user metadata, so the profile can be created on first login
      // even when e-mail confirmation is required before a session exists.
      const { data, error } = await supabase().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: siteUrl("/kabinet"), data: { full_name: `${v.firstName.trim()} ${v.lastName.trim()}`, profile: v } },
      });
      if (error) throw Object.assign(error, { isAuth: true });
      if (!data.session) {
        // E-mail confirmation is enabled in Supabase: ask the user to click the link first.
        setConfirmSent(email.trim());
        setBusy(false);
        setCreating(false);
        return;
      }
      await api<{ profile: Profile }>("/api/me", { method: "POST", body: v });
      await refreshProfile();
      router.replace(next);
    } catch (e) {
      if ((e as { isAuth?: boolean }).isAuth) setErr(authErrorMessage(e));
      else {
        // Account exists but profile provisioning failed — the profile page lets them retry.
        setErr(`Hisob yaratildi, lekin profilni saqlab bo‘lmadi: ${errorText(e)}`);
        setTimeout(() => router.replace(`/kabinet/profil?keyin=${encodeURIComponent(next)}`), 1800);
      }
      setBusy(false);
      setCreating(false);
    }
  };

  return (
    <AuthShell
      title="Ro‘yxatdan o‘tish"
      subtitle="Hisob ochilgach, sizga noyob Candidate ID beriladi. U har bir mock imtihonda javoblar varaqangizda ko‘rsatiladi."
      aside={
        <ul className="mt-10 space-y-3 border-t-[1.5px] border-ink pt-6 text-sm text-ink-2">
          {["Natijalaringiz faqat sizga ko‘rinadi", "Parol faqat Firebase Authentication’da xavfsiz saqlanadi", "Email tasdiqlash havolasi yuboriladi"].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="bubble bubble-sm cursor-default" data-filled="true" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {err && <Alert tone="error">{err}</Alert>}
        <ProfileFieldset v={v} set={(p) => setV((o) => ({ ...o, ...p }))} errors={errors} />
        <div className="hair" />
        <Field id="email" label="Email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className="field" value={email} aria-invalid={!!errors.email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="password" label="Parol" error={errors.password}>
            <input id="password" type="password" autoComplete="new-password" className="field" value={password} aria-invalid={!!errors.password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field id="password2" label="Parolni takrorlang" error={errors.password2}>
            <input id="password2" type="password" autoComplete="new-password" className="field" value={password2} aria-invalid={!!errors.password2} onChange={(e) => setPassword2(e.target.value)} />
          </Field>
        </div>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              <Link href="/shartlar" className="link" target="_blank">
                Foydalanish shartlari
              </Link>{" "}
              va{" "}
              <Link href="/maxfiylik" className="link" target="_blank">
                maxfiylik siyosati
              </Link>{" "}
              bilan tanishdim. Bu mustaqil mock-platforma ekanini va rasmiy sertifikat bermasligini tushunaman.
            </span>
          </label>
          {errors.agree && <p className="mt-1 text-xs text-accent-ink">{errors.agree}</p>}
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner />} Hisob ochish
        </button>
      </form>
      <GoogleButton returnTo={`/kabinet/profil?keyin=${encodeURIComponent(next)}`} />
      <p className="mt-6 text-sm text-ink-2">
        Hisobingiz bormi?{" "}
        <Link href="/kirish" className="link font-semibold">
          Kirish
        </Link>
      </p>
    </AuthShell>
  );
}

/* ----------------------------------------------------------- reset password */

export function ResetForm() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!configured) return <NotConfigured />;
  return (
    <AuthShell title="Parolni tiklash" subtitle="Email manzilingizga parolni yangilash havolasini yuboramiz.">
      {sent ? (
        <Alert tone="ok" title="Havola yuborildi">
          Agar bu email bilan hisob mavjud bo‘lsa, bir necha daqiqa ichida xat keladi. “Spam” papkasini ham tekshiring.{" "}
          <Link href="/kirish">Kirish sahifasiga qaytish</Link>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              // Supabase never reveals whether an account exists for this address.
              const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl("/parolni-yangilash") });
              if (error) setErr(authErrorMessage(error));
              else setSent(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {err && <Alert tone="error">{err}</Alert>}
          <Field id="email" label="Email">
            <input id="email" type="email" autoComplete="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy || !email}>
            {busy && <Spinner />} Havolani yuborish
          </button>
          <p className="text-sm">
            <Link href="/kirish" className="link">
              ← Kirish sahifasi
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
