export interface PaymentConfiguration {
  requested: boolean;
  ready: boolean;
  stripeSecretKeyPresent: boolean;
  stripeWebhookSecretPresent: boolean;
  siteUrl: string | null;
  sessionMinutes: number;
  problems: readonly string[];
}

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function normalizedSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPaymentConfiguration(): PaymentConfiguration {
  const requested = process.env.STRIPE_PAYMENTS_ENABLED === "true";
  const stripeSecretKeyPresent = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeWebhookSecretPresent = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const siteUrl = normalizedSiteUrl();
  const sessionMinutes = integerEnv("STRIPE_CHECKOUT_SESSION_MINUTES", 30, 30, 120);
  const problems: string[] = [];

  if (!stripeSecretKeyPresent) problems.push("stripe_secret_key_missing");
  if (!stripeWebhookSecretPresent) problems.push("stripe_webhook_secret_missing");
  if (!siteUrl) problems.push("canonical_site_url_missing");

  return {
    requested,
    ready: requested && problems.length === 0,
    stripeSecretKeyPresent,
    stripeWebhookSecretPresent,
    siteUrl,
    sessionMinutes,
    problems,
  };
}
