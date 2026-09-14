export interface CheckoutConfiguration {
  requested: boolean;
  ready: boolean;
  reservationSweeperReady: boolean;
  standardShippingCents: number | null;
  freeShippingThresholdCents: number | null;
  vatRateBps: number | null;
  reservationMinutes: number;
  problems: readonly string[];
}

function optionalInteger(name: string, options: { min: number; max: number }) {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < options.min || value > options.max) return null;
  return value;
}

export function getCheckoutConfiguration(): CheckoutConfiguration {
  const requested = process.env.CHECKOUT_PREPAYMENT_ENABLED === "true";
  const reservationSweeperReady = process.env.COMMERCE_RESERVATION_SWEEPER_READY === "true";
  const standardShippingCents = optionalInteger("COMMERCE_STANDARD_SHIPPING_CENTS", { min: 0, max: 100_000 });
  const freeShippingThresholdCents = optionalInteger("COMMERCE_FREE_SHIPPING_THRESHOLD_CENTS", { min: 1, max: 10_000_000 });
  const vatRateBps = optionalInteger("COMMERCE_VAT_RATE_BPS", { min: 1, max: 10_000 });
  const reservationMinutes = optionalInteger("COMMERCE_RESERVATION_MINUTES", { min: 5, max: 120 }) ?? 15;
  const problems: string[] = [];

  if (standardShippingCents == null) problems.push("shipping_rate_missing");
  if (vatRateBps == null) problems.push("vat_rate_missing");
  if (!reservationSweeperReady) problems.push("reservation_sweeper_not_ready");

  return {
    requested,
    ready: requested && problems.length === 0,
    reservationSweeperReady,
    standardShippingCents,
    freeShippingThresholdCents,
    vatRateBps,
    reservationMinutes,
    problems,
  };
}

export function shippingCentsForSubtotal(subtotalCents: number, configuration = getCheckoutConfiguration()) {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) throw new Error("INVALID_SUBTOTAL");
  if (configuration.standardShippingCents == null) throw new Error("SHIPPING_NOT_CONFIGURED");
  if (
    configuration.freeShippingThresholdCents != null &&
    subtotalCents >= configuration.freeShippingThresholdCents
  ) {
    return 0;
  }
  return configuration.standardShippingCents;
}
