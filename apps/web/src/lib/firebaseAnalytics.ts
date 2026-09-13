function readFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !authDomain || !projectId || !appId || !measurementId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    ...(storageBucket ? { storageBucket } : {}),
    ...(messagingSenderId ? { messagingSenderId } : {}),
    appId,
    measurementId,
  };
}

export async function enableFirebaseAnalytics() {
  if (typeof window === "undefined") return false;
  const firebaseConfig = readFirebaseConfig();
  if (!firebaseConfig) return false;

  const [{ getApp, getApps, initializeApp }, analytics] = await Promise.all([
    import("firebase/app"),
    import("firebase/analytics"),
  ]);

  if (!(await analytics.isSupported())) return false;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const instance = analytics.getAnalytics(app);
  analytics.setAnalyticsCollectionEnabled(instance, true);
  return true;
}

export async function disableFirebaseAnalytics() {
  if (typeof window === "undefined" || !readFirebaseConfig()) return;

  const [{ getApp, getApps }, analytics] = await Promise.all([
    import("firebase/app"),
    import("firebase/analytics"),
  ]);

  if (!getApps().length || !(await analytics.isSupported())) return;
  analytics.setAnalyticsCollectionEnabled(analytics.getAnalytics(getApp()), false);
}
