import "server-only";
import { randomUUID } from "node:crypto";
import { bucket, usingEmulators } from "./firebase-admin";

/**
 * Returns a short-lived URL to read a private Storage object.
 * Production: V4 signed URL (expires). If signing is unavailable (e.g. emulator),
 * falls back to a Firebase download-token URL that is only ever handed out by
 * authorised server routes.
 */
export async function readUrl(path: string, minutes = 60): Promise<string> {
  const file = bucket().file(path);
  if (!usingEmulators()) {
    try {
      const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + minutes * 60_000 });
      return url;
    } catch (e) {
      console.warn("[storage] signed URL failed, falling back to download token:", (e as Error).message);
    }
  }
  const [meta] = await file.getMetadata();
  let token = (meta.metadata?.firebaseStorageDownloadTokens as string | undefined)?.split(",")[0];
  if (!token) {
    token = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  const b = bucket().name;
  const host = usingEmulators() ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${b}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export async function objectMeta(path: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const [meta] = await bucket().file(path).getMetadata();
    return { size: Number(meta.size ?? 0), contentType: String(meta.contentType ?? "") };
  } catch {
    return null;
  }
}

export async function deleteObject(path: string): Promise<void> {
  await bucket()
    .file(path)
    .delete({ ignoreNotFound: true })
    .catch((e) => console.warn("[storage] delete failed", path, e));
}
