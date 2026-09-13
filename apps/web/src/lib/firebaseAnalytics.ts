import { getFirebaseClientApp, readFirebaseClientConfig } from "./firebaseClient";

export async function enableFirebaseAnalytics() {
  if (typeof window === "undefined") return false;
  const firebaseConfig = readFirebaseClientConfig();
  if (!firebaseConfig?.measurementId) return false;

  const analytics = await import("firebase/analytics");
  if (!(await analytics.isSupported())) return false;

  const instance = analytics.getAnalytics(getFirebaseClientApp());
  analytics.setAnalyticsCollectionEnabled(instance, true);
  return true;
}

export async function disableFirebaseAnalytics() {
  if (typeof window === "undefined" || !readFirebaseClientConfig()?.measurementId) return;

  const analytics = await import("firebase/analytics");
  if (!(await analytics.isSupported())) return;

  analytics.setAnalyticsCollectionEnabled(analytics.getAnalytics(getFirebaseClientApp()), false);
}
