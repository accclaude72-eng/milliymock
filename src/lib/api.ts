"use client";

import { clientConfigured, supabase } from "./supabase/client";

/** Current Supabase access token (auto-refreshed by supabase-js), or null when signed out. */
export async function accessToken(): Promise<string | null> {
  if (!clientConfigured) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Opts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach the candidate's Supabase access token. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
  keepalive?: boolean;
}

/** Typed fetch wrapper for our API: attaches auth, normalizes errors into readable Uzbek messages. */
export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && clientConfigured) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      keepalive: opts.keepalive,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "network", "Server bilan aloqa yo‘q. Internet ulanishini tekshiring.");
  }
  let json: { ok: boolean; data?: T; error?: { code: string; message: string } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !json?.ok) {
    throw new ApiClientError(res.status, json?.error?.code ?? "http_" + res.status, json?.error?.message ?? `So‘rov bajarilmadi (${res.status}).`);
  }
  return json.data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Kutilmagan xatolik.";
}
