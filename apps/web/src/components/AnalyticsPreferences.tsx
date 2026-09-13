"use client";

import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_PREFERENCES_EVENT,
} from "./AnalyticsConsent";

export function AnalyticsPreferences() {
  async function reopenPreferences() {
    const previous = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);

    if (previous === "accepted") {
      const { disableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await disableFirebaseAnalytics();
    }

    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT));
  }

  return (
    <button className="button" type="button" onClick={() => void reopenPreferences()}>
      Gestisci preferenze analytics
    </button>
  );
}
