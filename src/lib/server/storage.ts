import "server-only";
import { ApiError } from "./http";
import { sb } from "./supabase";

/** Short-lived URL to read a private object. Only handed out by authorised routes. */
export async function readUrl(bucket: string, path: string, minutes = 60): Promise<string> {
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, minutes * 60);
  if (error || !data) {
    console.error("[storage] sign url", bucket, path, error);
    throw new ApiError(404, "file_missing", "Fayl topilmadi.");
  }
  return data.signedUrl;
}

/** One-time signed upload URL so the browser can upload a file straight to a private bucket. */
export async function uploadUrl(bucket: string, path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await sb().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[storage] upload url", bucket, path, error);
    throw new ApiError(500, "storage_error", "Fayl yuklash uchun ruxsat olinmadi.");
  }
  return { path: data.path, token: data.token };
}

export async function objectMeta(bucket: string, path: string): Promise<{ size: number; contentType: string } | null> {
  const { data, error } = await sb().storage.from(bucket).info(path);
  if (error || !data) return null;
  return { size: Number(data.size ?? 0), contentType: String(data.contentType ?? "") };
}

export async function deleteObject(bucket: string, path: string): Promise<void> {
  const { error } = await sb().storage.from(bucket).remove([path]);
  if (error) console.warn("[storage] delete failed", bucket, path, error);
}
