"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field } from "@/components/auth-forms";
import { useAuth } from "@/components/auth-provider";
import { NotConfigured } from "@/components/guards";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { authErrorMessage, supabase } from "@/lib/supabase/client";

/** Opened from the password-reset e-mail: the link signs the user in, then they choose a new password. */
export default function Page() {
  const { configured, loading, user } = useAuth();
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoader />;
  if (!user)
    return (
      <AuthShell title="Yangi parol">
        <Alert tone="warn" title="Havola yaroqsiz yoki muddati tugagan">
          Parolni tiklash havolasini qaytadan so‘rang. <Link href="/parolni-tiklash">Yangi havola olish</Link>
        </Alert>
      </AuthShell>
    );

  return (
    <AuthShell title="Yangi parol" subtitle="Hisobingiz uchun yangi parol o‘rnating.">
      {done ? (
        <Alert tone="ok" title="Parol yangilandi">
          Endi yangi parol bilan kirasiz. <Link href="/kabinet">Kabinetga o‘tish</Link>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (p1.length < 8 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) return setErr("Kamida 8 ta belgi, harf va raqam bo‘lsin.");
            if (p1 !== p2) return setErr("Parollar mos emas.");
            setBusy(true);
            setErr(null);
            const { error } = await supabase().auth.updateUser({ password: p1 });
            setBusy(false);
            if (error) setErr(authErrorMessage(error));
            else {
              setDone(true);
              setTimeout(() => router.replace("/kabinet"), 1500);
            }
          }}
        >
          {err && <Alert tone="error">{err}</Alert>}
          <Field id="p1" label="Yangi parol">
            <input id="p1" type="password" autoComplete="new-password" className="field" value={p1} onChange={(e) => setP1(e.target.value)} />
          </Field>
          <Field id="p2" label="Parolni takrorlang">
            <input id="p2" type="password" autoComplete="new-password" className="field" value={p2} onChange={(e) => setP2(e.target.value)} />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy || !p1}>
            {busy && <Spinner />} Parolni saqlash
          </button>
        </form>
      )}
    </AuthShell>
  );
}
