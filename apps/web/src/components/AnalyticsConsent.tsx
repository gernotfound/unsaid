"use client";

import { useEffect, useState } from "react";
import styles from "./AnalyticsConsent.module.css";

export const ANALYTICS_CONSENT_KEY = "unsaid.analytics-consent.v1";
export const ANALYTICS_PREFERENCES_EVENT = "unsaid:analytics-preferences";

type Consent = "accepted" | "rejected" | null;

function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (/\/admin\/?$/.test(window.location.pathname)) {
      setHidden(true);
      setReady(true);
      return;
    }

    const initial = readConsent();
    setConsent(initial);
    setReady(true);

    if (initial === "accepted") {
      void import("../lib/firebaseAnalytics").then(({ enableFirebaseAnalytics }) =>
        enableFirebaseAnalytics(),
      );
    }

    const reopen = () => setConsent(null);
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, reopen);
  }, []);

  async function choose(next: Exclude<Consent, null>) {
    const previous = readConsent();
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
    setConsent(next);

    if (next === "accepted") {
      const { enableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await enableFirebaseAnalytics();
      return;
    }

    if (previous === "accepted") {
      const { disableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await disableFirebaseAnalytics();
    }
  }

  if (!ready || hidden || consent !== null) return null;

  return (
    <aside className={styles.panel} aria-label="Preferenze analytics">
      <div>
        <p className={styles.kicker}>ANALYTICS / OPTIONAL</p>
        <p className={styles.copy}>
          Usiamo Google Analytics solo se lo accetti. Il sito funziona anche senza tracking.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void choose("rejected")}>
          No grazie
        </button>
        <button type="button" className={styles.primary} onClick={() => void choose("accepted")}>
          Accetta
        </button>
      </div>
    </aside>
  );
}
