export const ANALYTICS_CONSENT_KEY = "unsaid.analytics-consent.v2";
export const LEGACY_ANALYTICS_CONSENT_KEY = "unsaid.analytics-consent.v1";
export const ANALYTICS_PREFERENCES_EVENT = "unsaid:analytics-preferences";
export const ANALYTICS_CONSENT_VERSION = 2;
export const ANALYTICS_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export type AnalyticsConsentDecision = "accepted" | "rejected";

interface AnalyticsConsentRecord {
  decision: AnalyticsConsentDecision;
  version: number;
  decidedAt: string;
}

export function readAnalyticsConsent(): AnalyticsConsentDecision | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsConsentRecord>;
    const decidedAt = typeof parsed.decidedAt === "string"
      ? Date.parse(parsed.decidedAt)
      : Number.NaN;

    if (
      parsed.version !== ANALYTICS_CONSENT_VERSION ||
      (parsed.decision !== "accepted" && parsed.decision !== "rejected") ||
      !Number.isFinite(decidedAt) ||
      Date.now() - decidedAt >= ANALYTICS_CONSENT_TTL_MS
    ) {
      window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
      return null;
    }

    return parsed.decision;
  } catch {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
    return null;
  }
}

export function writeAnalyticsConsent(decision: AnalyticsConsentDecision) {
  if (typeof window === "undefined") return;

  const record: AnalyticsConsentRecord = {
    decision,
    version: ANALYTICS_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify(record));
  window.localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_KEY);
}

export function clearAnalyticsConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  window.localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_KEY);
}

export function clearGoogleAnalyticsCookies() {
  if (typeof document === "undefined") return;

  for (const item of document.cookie.split(";")) {
    const name = item.split("=")[0]?.trim();
    if (!name || (name !== "_ga" && !name.startsWith("_ga_"))) continue;

    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax`;

    const domainParts = window.location.hostname.split(".");
    if (domainParts.length > 2) {
      const parentDomain = `.${domainParts.slice(-2).join(".")}`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${parentDomain}; SameSite=Lax`;
    }
  }
}
