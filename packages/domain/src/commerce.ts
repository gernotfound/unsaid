import type { CustomerAddress } from "./account";

export const GARMENT_COLORS = ["white", "black"] as const;
export const GARMENT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const COMMERCE_POLICY = {
  market: "IT",
  currency: "EUR",
  requiresAccount: true,
  requiresVerifiedEmail: true,
  catalogMode: "continuous",
  allowedShippingCountries: ["IT"],
} as const;

export type SalesCountry = (typeof COMMERCE_POLICY.allowedShippingCountries)[number];
export type Currency = typeof COMMERCE_POLICY.currency;
export type GarmentColor = (typeof GARMENT_COLORS)[number];
export type GarmentSize = (typeof GARMENT_SIZES)[number];

export interface Money {
  amountCents: number;
  currency: Currency;
}

export interface SellableProduct {
  catalogId: string;
  active: boolean;
  price: Money;
  taxClass: string;
  garmentColor: GarmentColor;
  updatedAt: string;
}

export interface SellableVariant {
  id: string;
  catalogId: string;
  sku: string;
  size: GarmentSize;
  garmentColor: GarmentColor;
  active: boolean;
}

export interface InventorySnapshot {
  variantId: string;
  onHand: number;
  reserved: number;
  updatedAt: string;
}

export type InventoryReservationStatus = "active" | "released" | "committed";

export interface InventoryReservation {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  status: InventoryReservationStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface CommerceVariantConfiguration {
  size: GarmentSize;
  active: boolean;
  onHand: number;
}

export interface CommerceConfigurationInput {
  catalogId: string;
  active: boolean;
  priceCents: number;
  taxClass: string;
  garmentColor: GarmentColor;
  variants: readonly CommerceVariantConfiguration[];
}

const COLOR_CODES: Record<GarmentColor, string> = {
  white: "WHT",
  black: "BLK",
};

export function commerceVariantId(catalogId: string, garmentColor: GarmentColor, size: GarmentSize) {
  if (!/^UNS-\d{4,}$/.test(catalogId)) throw new Error("INVALID_CATALOG_ID");
  return `${catalogId}-${COLOR_CODES[garmentColor]}-${size}`;
}

export function commerceSku(catalogId: string, garmentColor: GarmentColor, size: GarmentSize) {
  return commerceVariantId(catalogId, garmentColor, size);
}

export function validateCommerceConfiguration(input: CommerceConfigurationInput) {
  const errors: string[] = [];
  if (!/^UNS-\d{4,}$/.test(input.catalogId)) errors.push("INVALID_CATALOG_ID");
  if (!GARMENT_COLORS.includes(input.garmentColor)) errors.push("INVALID_GARMENT_COLOR");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0 || input.priceCents > 10_000_000) {
    errors.push("INVALID_PRICE");
  }
  if (input.active && input.priceCents < 1) errors.push("ACTIVE_PRODUCT_REQUIRES_PRICE");
  if (!input.taxClass.trim() || input.taxClass.trim().length > 64) errors.push("INVALID_TAX_CLASS");
  if (!input.variants.length) errors.push("VARIANTS_REQUIRED");

  const seen = new Set<GarmentSize>();
  let activeVariants = 0;
  for (const variant of input.variants) {
    if (!GARMENT_SIZES.includes(variant.size)) errors.push("INVALID_SIZE");
    if (seen.has(variant.size)) errors.push("DUPLICATE_SIZE");
    seen.add(variant.size);
    if (!Number.isInteger(variant.onHand) || variant.onHand < 0 || variant.onHand > 1_000_000) {
      errors.push(`INVALID_STOCK:${variant.size}`);
    }
    if (variant.active) activeVariants += 1;
  }

  if (input.active && activeVariants === 0) errors.push("ACTIVE_PRODUCT_REQUIRES_VARIANT");
  return [...new Set(errors)];
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderLine {
  variantId: string;
  sku: string;
  catalogId: string;
  title: string;
  size: GarmentSize;
  garmentColor: GarmentColor;
  quantity: number;
  unitPrice: Money;
}

export interface OrderTotals {
  subtotal: Money;
  shipping: Money;
  tax: Money;
  total: Money;
}

export interface OrderShippingMethod {
  id: string;
  label: string;
  country: SalesCountry;
  price: Money;
}

export interface OrderTaxSnapshot {
  includedInPrices: true;
  rateBps: number;
}

export interface Order {
  id: string;
  customerId: string;
  email: string;
  shippingAddress: CustomerAddress;
  lines: readonly OrderLine[];
  totals: OrderTotals;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  shippingMethod?: OrderShippingMethod;
  taxSnapshot?: OrderTaxSnapshot;
  reservationExpiresAt?: string;
}

export type PaymentStatus = "requires_action" | "authorized" | "paid" | "failed" | "refunded";

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string;
  status: PaymentStatus;
  amount: Money;
  updatedAt: string;
}

export type ShipmentStatus = "pending" | "ready" | "shipped" | "delivered" | "returned";

export interface ShipmentRecord {
  id: string;
  orderId: string;
  provider: string;
  trackingCode?: string;
  status: ShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface PaymentProvider {
  createPayment(input: {
    orderId: string;
    customerId: string;
    amount: Money;
    idempotencyKey: string;
  }): Promise<{ providerPaymentId: string; clientSecret?: string }>;
}

export interface InventoryRepository {
  getAvailability(variantId: string): Promise<InventorySnapshot | null>;
  reserve(input: { variantId: string; quantity: number; orderId: string }): Promise<void>;
  release(input: { variantId: string; quantity: number; orderId: string }): Promise<void>;
  commit(input: { variantId: string; quantity: number; orderId: string }): Promise<void>;
}

export interface OrderRepository {
  getById(orderId: string): Promise<Order | null>;
  listByCustomer(customerId: string, limit?: number): Promise<readonly Order[]>;
  create(order: Order): Promise<void>;
  updateStatus(orderId: string, status: OrderStatus): Promise<void>;
}

export interface SellableProductRepository {
  getProduct(catalogId: string): Promise<SellableProduct | null>;
  listVariants(catalogId: string): Promise<readonly SellableVariant[]>;
}

export interface CheckoutEligibilityInput {
  commerceEnabled: boolean;
  authenticated: boolean;
  emailVerified: boolean;
  shippingCountry?: string;
}

export type CheckoutEligibility =
  | { allowed: true }
  | { allowed: false; reason: "commerce_disabled" | "account_required" | "email_unverified" | "country_unsupported" };

export function isAllowedShippingCountry(value: string): value is SalesCountry {
  return COMMERCE_POLICY.allowedShippingCountries.includes(value as SalesCountry);
}

export function availableInventory(snapshot: Pick<InventorySnapshot, "onHand" | "reserved">) {
  return Math.max(0, snapshot.onHand - snapshot.reserved);
}

export function calculateGrossOrderTotals(input: {
  subtotalCents: number;
  shippingCents: number;
  vatRateBps: number;
}): OrderTotals {
  const { subtotalCents, shippingCents, vatRateBps } = input;
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) throw new Error("INVALID_SUBTOTAL");
  if (!Number.isInteger(shippingCents) || shippingCents < 0) throw new Error("INVALID_SHIPPING");
  if (!Number.isInteger(vatRateBps) || vatRateBps < 0 || vatRateBps > 10_000) throw new Error("INVALID_VAT_RATE");

  const totalCents = subtotalCents + shippingCents;
  const taxCents = vatRateBps === 0 ? 0 : Math.round((totalCents * vatRateBps) / (10_000 + vatRateBps));
  return {
    subtotal: { amountCents: subtotalCents, currency: "EUR" },
    shipping: { amountCents: shippingCents, currency: "EUR" },
    tax: { amountCents: taxCents, currency: "EUR" },
    total: { amountCents: totalCents, currency: "EUR" },
  };
}

export function checkoutEligibility(input: CheckoutEligibilityInput): CheckoutEligibility {
  if (!input.commerceEnabled) return { allowed: false, reason: "commerce_disabled" };
  if (COMMERCE_POLICY.requiresAccount && !input.authenticated) {
    return { allowed: false, reason: "account_required" };
  }
  if (COMMERCE_POLICY.requiresVerifiedEmail && !input.emailVerified) {
    return { allowed: false, reason: "email_unverified" };
  }
  if (input.shippingCountry && !isAllowedShippingCountry(input.shippingCountry)) {
    return { allowed: false, reason: "country_unsupported" };
  }
  return { allowed: true };
}
