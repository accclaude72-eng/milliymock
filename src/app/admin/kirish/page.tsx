"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Logo, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <main id="asosiy" className="graph-paper flex min-h-dvh items-center justify-center px-4 py-10">
      <form
        className="crop sheet-hard w-full max-w-sm p-7"
        autoComplete="off"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code) return;
          setBusy(true);
          setErr(null);
          try {
            await api("/api/admin/login", { method: "POST", body: { code }, auth: false });
            setCode("");
            router.replace("/admin");
            router.refresh();
          } catch (e2) {
            setErr(errorText(e2));
            setCode("");
            setBusy(false);
          }
        }}
      >
        <Logo className="text-sm" />
        <h1 className="display mt-6 text-4xl">Boshqaruv paneli</h1>
        <p className="mt-2 text-sm text-ink-2">Davom etish uchun kirish kodini kiriting.</p>
        {err && (
          <Alert tone="error" className="mt-4">
            {err}
          </Alert>
        )}
        <label className="label mt-6" htmlFor="code">
          Kirish kodi
        </label>
        <input
          id="code"
          name="admin-access"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="field num tracking-widest"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        <button className="btn btn-ink mt-5 w-full" disabled={busy || !code}>
          {busy && <Spinner />} Kirish
        </button>
        <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">Barcha urinishlar jurnalga yoziladi</p>
      </form>
    </main>
  );
}
