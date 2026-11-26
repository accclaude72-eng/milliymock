import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { ApiError } from "./http";

const APP_NAME = "milliy-mock-admin";

export function usingEmulators(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

export function firebaseConfigured(): boolean {
  const p = process.env;
  if (usingEmulators()) return !!(p.FIREBASE_PROJECT_ID && p.FIREBASE_STORAGE_BUCKET);
  return !!(p.FIREBASE_PROJECT_ID && p.FIREBASE_CLIENT_EMAIL && p.FIREBASE_PRIVATE_KEY && p.FIREBASE_STORAGE_BUCKET);
}

const g = globalThis as unknown as { __mmFirestoreConfigured?: boolean };

function app(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  if (!firebaseConfigured()) {
    throw new ApiError(
      503,
      "firebase_not_configured",
      "Firebase hali sozlanmagan. Administrator .env.local faylida Firebase kalitlarini kiritishi kerak (README ga qarang).",
    );
  }
  const projectId = process.env.FIREBASE_PROJECT_ID!;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET!;
  if (usingEmulators()) return initializeApp({ projectId, storageBucket }, APP_NAME);
  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      projectId,
      storageBucket,
    },
    APP_NAME,
  );
}

export function db(): Firestore {
  const fs = getFirestore(app());
  if (!g.__mmFirestoreConfigured) {
    g.__mmFirestoreConfigured = true;
    try {
      fs.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* already initialised (hot reload) */
    }
  }
  return fs;
}

export function adminAuth(): Auth {
  return getAuth(app());
}

export function bucket() {
  return getStorage(app()).bucket();
}
