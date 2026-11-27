"use client";

import { adminApi } from "./admin-api";
import { supabase } from "./supabase/client";

/**
 * Uploads a processed HTML booklet straight to the private Supabase `booklets` bucket using a
 * one-time signed upload URL issued to the verified admin session (no web-server size limit).
 */
export async function uploadBooklet(html: string, onProgress: (pct: number) => void): Promise<{ path: string; fileName: string }> {
  const up = await adminApi<{ bucket: string; path: string; token: string }>("/api/admin/storage-token");
  onProgress(5);
  const blob = new Blob([html], { type: "text/html" });
  const { error } = await supabase().storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, blob, { contentType: "text/html", cacheControl: "0" });
  if (error) throw new Error(`Yuklashda xatolik: ${error.message}`);
  onProgress(100);
  return { path: up.path, fileName: "booklet.html" };
}
