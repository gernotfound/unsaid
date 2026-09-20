import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

type AdminEnvName =
  | "FIREBASE_PROJECT_ID"
  | "FIREBASE_CLIENT_EMAIL"
  | "FIREBASE_PRIVATE_KEY"
  | "FIREBASE_STORAGE_BUCKET";

function required(name: AdminEnvName) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  return initializeApp({
    credential: cert({
      projectId: required("FIREBASE_PROJECT_ID"),
      clientEmail: required("FIREBASE_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function isFirebaseStorageConfigured() {
  return isFirebaseConfigured() && Boolean(process.env.FIREBASE_STORAGE_BUCKET);
}

export function getAdminFirestore(): Firestore {
  return getFirestore(createAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(createAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(createAdminApp());
}

export function getAdminStorageBucketName() {
  return required("FIREBASE_STORAGE_BUCKET");
}

export function getAdminStorageBucket() {
  return getAdminStorage().bucket(getAdminStorageBucketName());
}
