"use client";

import { ApiClientError, api } from "./api";

/**
 * Admin API calls rely on the httpOnly admin session cookie (never a header/token in JS).
 * On an expired session we send the admin back to the code screen.
 */
export async function adminApi<T>(path: string, opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {}): Promise<T> {
  try {
    return await api<T>(path, { ...opts, auth: false });
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 401 && e.code === "admin_required" && typeof window !== "undefined") {
      // Full reload on purpose: drops all in-memory admin state when the session has expired.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin/kirish");
    }
    throw e;
  }
}
