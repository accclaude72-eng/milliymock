"use client";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
// Only the public (publishable/anon) key is ever used in the browser.
// (next.config.ts maps SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / *_ANON_KEY onto these two names.)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const clientConfigured = !!(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!clientConfigured) throw new Error("Supabase sozlanmagan");
  client ??= createClient(url!, key!, {
    // Implicit flow: confirmation / reset links work even when opened on a different device.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  return client;
}

/** Absolute URL of this site, used for e-mail confirmation / password-reset redirects. */
export function siteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/$/, "") + path;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Email yoki parol noto‘g‘ri.",
  email_not_confirmed: "Email manzilingiz hali tasdiqlanmagan. Pochtangizdagi havolani bosing.",
  user_already_exists: "Bu email bilan hisob allaqachon mavjud. Kirish sahifasidan foydalaning.",
  email_exists: "Bu email bilan hisob allaqachon mavjud. Kirish sahifasidan foydalaning.",
  weak_password: "Parol juda oddiy — kamida 8 ta belgi, harf va raqam ishlating.",
  over_request_rate_limit: "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.",
  over_email_send_rate_limit: "Juda ko‘p xat so‘raldi. Bir oz kutib, qayta urinib ko‘ring.",
  user_banned: "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.",
  signup_disabled: "Yangi ro‘yxatdan o‘tish vaqtincha yopilgan.",
  email_address_invalid: "Email manzili noto‘g‘ri kiritilgan.",
  validation_failed: "Kiritilgan ma’lumotlar noto‘g‘ri.",
  same_password: "Yangi parol eskisidan farq qilishi kerak.",
  otp_expired: "Havola muddati tugagan. Yangisini so‘rang.",
  provider_disabled: "Bu kirish usuli hozircha yoqilmagan.",
};

export function authErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; name?: string };
  if (err?.code && AUTH_ERRORS[err.code]) return AUTH_ERRORS[err.code];
  if (err?.name === "AuthRetryableFetchError" || /fetch/i.test(err?.message ?? "")) return "Internet aloqasi yo‘q. Ulanishni tekshiring.";
  return "Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.";
}
