"use client";

import {
  ANALYTICS_PREFERENCES_EVENT,
  clearAnalyticsConsent,
  readAnalyticsConsent,
} from "../lib/analyticsConsent";

type Props = {
  className?: string;
  label?: string;
};

export function AnalyticsPreferences({
  className = "button",
  label = "Gestisci preferenze analytics",
}: Props) {
  async function reopenPreferences() {
    const previous = readAnalyticsConsent();

    if (previous === "accepted") {
      const { disableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await disableFirebaseAnalytics();
    }

    clearAnalyticsConsent();
    window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT));
  }

  return (
    <button className={className} type="button" onClick={() => void reopenPreferences()}>
      {label}
    </button>
  );
}
