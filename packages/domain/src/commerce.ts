import type { CustomerAddress } from "./account";

export const COMMERCE_POLICY = {
  market: "IT",
  currency: "EUR",
  requiresAccount: true,
  catalogMode: "continuous",
  allowedShippingCountries: ["IT"],
} as const;

export type SalesCountry = (typeof COMMERCE_POLICY.allowedShippingCountries)[number];
export type Currency = typeof COMMERCE_POLICY.currency;
export type GarmentColor = "white" | "black";
export type GarmentSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface Money {
  amountCents: number;
  currency: Currency;
}

export interface SellableProduct {
  catalogId: string;
  active: boolean;
  price: Money;
  taxClass: string;
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
}

export interface OrderRepository {
  getById(orderId: string): Promise<Order | null>;
  create(order: Order): Promise<void>;
  updateStatus(orderId: string, status: OrderStatus): Promise<void>;
}

export function isAllowedShippingCountry(value: string): value is SalesCountry {
  return COMMERCE_POLICY.allowedShippingCountries.includes(value as SalesCountry);
}

export function availableInventory(snapshot: Pick<InventorySnapshot, "onHand" | "reserved">) {
  return Math.max(0, snapshot.onHand - snapshot.reserved);
}
