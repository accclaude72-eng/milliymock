"use client";

import { signInWithCustomToken } from "firebase/auth";
import { ref, uploadBytesResumable } from "firebase/storage";
import { adminApi } from "./admin-api";
import { adminUploaderApp } from "./firebase/client";

function uploadId(): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return r.slice(0, 32);
}

/**
 * Uploads a processed HTML booklet straight to Firebase Storage (no size limit from
 * the web server). Auth: a short-lived custom token issued to the verified admin session.
 */
export async function uploadBooklet(html: string, onProgress: (pct: number) => void): Promise<{ path: string; fileName: string }> {
  const { token } = await adminApi<{ token: string }>("/api/admin/storage-token");
  const { auth, storage } = adminUploaderApp();
  await signInWithCustomToken(auth, token);
  const fileName = "booklet.html";
  const path = `materials/${uploadId()}/${fileName}`;
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType: "text/html; charset=utf-8", cacheControl: "private, max-age=0" });
    task.on(
      "state_changed",
      (s) => onProgress(s.totalBytes ? Math.round((s.bytesTransferred / s.totalBytes) * 100) : 0),
      (err) => reject(new Error(err.code === "storage/unauthorized" ? "Storage ruxsat bermadi — storage.rules joylanganini tekshiring." : `Yuklashda xatolik: ${err.message}`)),
      () => resolve(),
    );
  });
  await auth.signOut().catch(() => undefined);
  return { path, fileName };
}
