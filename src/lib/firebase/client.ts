"use client";

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth, inMemoryPersistence, initializeAuth } from "firebase/auth";
import { type FirebaseStorage, connectStorageEmulator, getStorage } from "firebase/storage";

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const clientConfigured = !!(config.apiKey && config.projectId && config.storageBucket);
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const connected = new WeakSet<object>();

function appNamed(name?: string): FirebaseApp {
  if (!clientConfigured) throw new Error("Firebase sozlanmagan");
  const appName = name ?? "[DEFAULT]";
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return existing;
  return name ? initializeApp(config, name) : initializeApp(config);
}

/** Candidate authentication (persisted in the browser). */
export function candidateAuth(): Auth {
  const app = getApps().length ? getApp() : appNamed();
  const auth = getAuth(app);
  if (useEmulators && !connected.has(auth)) {
    connected.add(auth);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  auth.languageCode = "uz";
  return auth;
}

export function candidateStorage(): FirebaseStorage {
  const app = getApps().find((a) => a.name === "[DEFAULT]") ?? appNamed();
  const s = getStorage(app);
  if (useEmulators && !connected.has(s)) {
    connected.add(s);
    connectStorageEmulator(s, "127.0.0.1", 9199);
  }
  return s;
}

/**
 * A separate, in-memory Firebase app for the admin uploader so the admin's short-lived
 * custom token is never persisted and never collides with a candidate session.
 */
export function adminUploaderApp(): { auth: Auth; storage: FirebaseStorage } {
  const name = "admin-uploader";
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? appNamed(name);
  const auth = existing ? getAuth(app) : initializeAuth(app, { persistence: inMemoryPersistence });
  const storage = getStorage(app);
  if (useEmulators && !connected.has(auth)) {
    connected.add(auth);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return { auth, storage };
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email yoki parol noto‘g‘ri.",
  "auth/wrong-password": "Email yoki parol noto‘g‘ri.",
  "auth/user-not-found": "Email yoki parol noto‘g‘ri.",
  "auth/invalid-email": "Email manzili noto‘g‘ri kiritilgan.",
  "auth/email-already-in-use": "Bu email bilan hisob allaqachon mavjud. Kirish sahifasidan foydalaning.",
  "auth/weak-password": "Parol juda oddiy — kamida 8 ta belgi, harf va raqam ishlating.",
  "auth/too-many-requests": "Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.",
  "auth/network-request-failed": "Internet aloqasi yo‘q. Ulanishni tekshiring.",
  "auth/user-disabled": "Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.",
  "auth/popup-closed-by-user": "Kirish oynasi yopildi.",
  "auth/operation-not-allowed": "Bu kirish usuli hozircha yoqilmagan.",
  "auth/missing-password": "Parolni kiriting.",
  "auth/expired-action-code": "Havola muddati tugagan. Yangisini so‘rang.",
  "auth/invalid-action-code": "Havola yaroqsiz yoki allaqachon ishlatilgan.",
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? "Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.";
}
