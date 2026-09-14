"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ANALYTICS_PREFERENCES_EVENT,
  clearAnalyticsConsent,
  clearGoogleAnalyticsCookies,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentDecision,
} from "../lib/analyticsConsent";
import styles from "./AnalyticsConsent.module.css";

type Props = {
  enabled: boolean;
};

export function AnalyticsConsent({ enabled }: Props) {
  const [consent, setConsent] = useState<AnalyticsConsentDecision | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      clearAnalyticsConsent();
      clearGoogleAnalyticsCookies();
      setConsent("rejected");
      setReady(true);
      return;
    }

    const initial = readAnalyticsConsent();
    setConsent(initial);
    setReady(true);

    if (initial === "accepted") {
      void import("../lib/firebaseAnalytics").then(({ enableFirebaseAnalytics }) =>
        enableFirebaseAnalytics(),
      );
    }

    const reopen = () => {
      setConsent(null);
      setReady(true);
    };

    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, reopen);
  }, [enabled]);

  async function choose(next: AnalyticsConsentDecision) {
    const previous = readAnalyticsConsent();
    writeAnalyticsConsent(next);
    setConsent(next);

    if (next === "accepted") {
      const { enableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await enableFirebaseAnalytics();
      return;
    }

    clearGoogleAnalyticsCookies();
    if (previous === "accepted") {
      const { disableFirebaseAnalytics } = await import("../lib/firebaseAnalytics");
      await disableFirebaseAnalytics();
    }
  }

  if (!ready || !enabled || consent !== null) return null;

  return (
    <aside className={styles.panel} aria-label="Preferenze privacy e analytics">
      <button
        type="button"
        className={styles.close}
        aria-label="Continua senza analytics"
        title="Continua senza analytics"
        onClick={() => void choose("rejected")}
      >
        ×
      </button>

      <div>
        <p className={styles.kicker}>PRIVACY / ANALYTICS OPTIONAL</p>
        <p className={styles.copy}>
          Per impostazione predefinita non attiviamo strumenti analytics. Google Analytics parte solo se scegli
          di accettarlo; rifiutare o chiudere questo pannello non limita il sito.
        </p>
        <p className={styles.links}>
          <Link href="/cookies">Cookie policy</Link>
          <span aria-hidden="true">/</span>
          <Link href="/privacy">Privacy</Link>
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void choose("rejected")}>
          Rifiuta
        </button>
        <button type="button" className={styles.primary} onClick={() => void choose("accepted")}>
          Accetta analytics
        </button>
      </div>
    </aside>
  );
}
