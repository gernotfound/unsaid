import type { PublicCatalogRecord } from "@unsaid/catalog";
import {
  calculateGrossOrderTotals,
  validateItalianAddress,
  type CustomerAddress,
  type InventoryReservation,
  type InventorySnapshot,
  type Order,
  type OrderLine,
  type SellableProduct,
  type SellableVariant,
} from "@unsaid/domain";
import {
  INVENTORY_COLLECTION,
  INVENTORY_RESERVATIONS_COLLECTION,
  SELLABLE_PRODUCTS_COLLECTION,
  VARIANTS_COLLECTION,
} from "./commerce";
import { getAdminFirestore } from "./firebase";

const PUBLIC_CATALOG_COLLECTION = "publicCatalog";
const CHECKOUT_ATTEMPTS_COLLECTION = "checkoutAttempts";
const MAX_CART_LINES = 25;
const MAX_LINE_QUANTITY = 20;
const VARIANT_ID_PATTERN = /^UNS-\d{4,}-(?:WHT|BLK)-(?:XS|S|M|L|XL|XXL)$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

export interface CheckoutCartLineInput {
  variantId: string;
  quantity: number;
}

export interface CheckoutPricingConfiguration {
  standardShippingCents: number;
  freeShippingThresholdCents: number | null;
  vatRateBps: number;
  reservationMinutes: number;
}

export interface PreparePendingOrderInput {
  customerId: string;
  email: string;
  shippingAddress: CustomerAddress;
  lines: readonly CheckoutCartLineInput[];
  idempotencyKey: string;
  pricing: CheckoutPricingConfiguration;
}

type CheckoutAttempt = {
  id: string;
  customerId: string;
  orderId: string;
  requestKey: string;
  status: "pending_payment" | "cancelled";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeLines(lines: readonly CheckoutCartLineInput[]) {
  if (!lines.length) throw new Error("CART_EMPTY");
  if (lines.length > MAX_CART_LINES) throw new Error("CART_TOO_LARGE");

  const normalized = new Map<string, number>();
  for (const line of lines) {
    const variantId = typeof line.variantId === "string" ? line.variantId.trim() : "";
    const quantity = Number(line.quantity);
    if (!VARIANT_ID_PATTERN.test(variantId)) throw new Error("INVALID_VARIANT");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      throw new Error("INVALID_QUANTITY");
    }
    const next = (normalized.get(variantId) ?? 0) + quantity;
    if (next > MAX_LINE_QUANTITY) throw new Error("INVALID_QUANTITY");
    normalized.set(variantId, next);
  }

  return [...normalized.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));
}

function validatePricing(pricing: CheckoutPricingConfiguration) {
  if (!Number.isInteger(pricing.standardShippingCents) || pricing.standardShippingCents < 0 || pricing.standardShippingCents > 100_000) {
    throw new Error("INVALID_SHIPPING_CONFIGURATION");
  }
  if (
    pricing.freeShippingThresholdCents != null &&
    (!Number.isInteger(pricing.freeShippingThresholdCents) || pricing.freeShippingThresholdCents < 1 || pricing.freeShippingThresholdCents > 10_000_000)
  ) {
    throw new Error("INVALID_SHIPPING_CONFIGURATION");
  }
  if (!Number.isInteger(pricing.vatRateBps) || pricing.vatRateBps < 1 || pricing.vatRateBps > 10_000) {
    throw new Error("INVALID_VAT_CONFIGURATION");
  }
  if (!Number.isInteger(pricing.reservationMinutes) || pricing.reservationMinutes < 5 || pricing.reservationMinutes > 120) {
    throw new Error("INVALID_RESERVATION_CONFIGURATION");
  }
}

function requestKey(
  addressId: string,
  lines: readonly CheckoutCartLineInput[],
  pricing: CheckoutPricingConfiguration,
) {
  return [
    addressId,
    ...lines.map((line) => `${line.variantId}:${line.quantity}`),
    `ship:${pricing.standardShippingCents}`,
    `free:${pricing.freeShippingThresholdCents ?? "none"}`,
    `vat:${pricing.vatRateBps}`,
    `hold:${pricing.reservationMinutes}`,
  ].join("|");
}

function shippingCents(subtotalCents: number, pricing: CheckoutPricingConfiguration) {
  return pricing.freeShippingThresholdCents != null && subtotalCents >= pricing.freeShippingThresholdCents
    ? 0
    : pricing.standardShippingCents;
}

function reservationId(orderId: string, variantId: string) {
  return `${orderId}__${variantId}`;
}

export async function preparePendingOrder(input: PreparePendingOrderInput): Promise<Order> {
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  if (!input.customerId || !input.email) throw new Error("INVALID_CUSTOMER");
  const addressProblems = validateItalianAddress(input.shippingAddress);
  if (addressProblems.length || input.shippingAddress.country !== "IT") throw new Error("INVALID_SHIPPING_ADDRESS");
  validatePricing(input.pricing);
  const lines = normalizeLines(input.lines);

  const db = getAdminFirestore();
  const timestamp = now();
  const expiresAt = new Date(Date.now() + input.pricing.reservationMinutes * 60_000).toISOString();
  const orderId = `ORD-${input.idempotencyKey}`;
  const attemptId = `${input.customerId}__${input.idempotencyKey}`;
  const orderRef = db.collection("orders").doc(orderId);
  const attemptRef = db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId);
  const expectedRequestKey = requestKey(input.shippingAddress.id, lines, input.pricing);

  return db.runTransaction(async (transaction) => {
    const [attemptSnapshot, orderSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(orderRef),
    ]);

    if (attemptSnapshot.exists) {
      const attempt = attemptSnapshot.data() as CheckoutAttempt;
      if (attempt.customerId !== input.customerId || attempt.requestKey !== expectedRequestKey) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      if (!orderSnapshot.exists) throw new Error("CHECKOUT_STATE_CORRUPT");
      return orderSnapshot.data() as Order;
    }
    if (orderSnapshot.exists) throw new Error("CHECKOUT_STATE_CONFLICT");

    const variantRefs = lines.map((line) => db.collection(VARIANTS_COLLECTION).doc(line.variantId));
    const variantSnapshots = await Promise.all(variantRefs.map((ref) => transaction.get(ref)));
    const variants = new Map<string, SellableVariant>();
    for (const snapshot of variantSnapshots) {
      if (snapshot.exists) variants.set(snapshot.id, snapshot.data() as SellableVariant);
    }

    for (const line of lines) {
      const variant = variants.get(line.variantId);
      if (!variant || !variant.active) throw new Error(`VARIANT_UNAVAILABLE:${line.variantId}`);
    }

    const catalogIds = [...new Set([...variants.values()].map((variant) => variant.catalogId))];
    const productRefs = catalogIds.map((catalogId) => db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(catalogId));
    const catalogRefs = catalogIds.map((catalogId) => db.collection(PUBLIC_CATALOG_COLLECTION).doc(catalogId));
    const inventoryRefs = lines.map((line) => db.collection(INVENTORY_COLLECTION).doc(line.variantId));
    const reservationRefs = lines.map((line) => db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(orderId, line.variantId)));

    const [productSnapshots, catalogSnapshots, inventorySnapshots, reservationSnapshots] = await Promise.all([
      Promise.all(productRefs.map((ref) => transaction.get(ref))),
      Promise.all(catalogRefs.map((ref) => transaction.get(ref))),
      Promise.all(inventoryRefs.map((ref) => transaction.get(ref))),
      Promise.all(reservationRefs.map((ref) => transaction.get(ref))),
    ]);

    if (reservationSnapshots.some((snapshot) => snapshot.exists)) throw new Error("CHECKOUT_STATE_CONFLICT");

    const products = new Map<string, SellableProduct>();
    for (const snapshot of productSnapshots) {
      if (snapshot.exists) products.set(snapshot.id, snapshot.data() as SellableProduct);
    }
    const catalog = new Map<string, PublicCatalogRecord>();
    for (const snapshot of catalogSnapshots) {
      if (snapshot.exists) catalog.set(snapshot.id, snapshot.data() as PublicCatalogRecord);
    }
    const inventory = new Map<string, InventorySnapshot>();
    for (const snapshot of inventorySnapshots) {
      if (snapshot.exists) inventory.set(snapshot.id, snapshot.data() as InventorySnapshot);
    }

    const orderLines: OrderLine[] = [];
    let subtotalCents = 0;

    for (const line of lines) {
      const variant = variants.get(line.variantId)!;
      const product = products.get(variant.catalogId);
      const publicProduct = catalog.get(variant.catalogId);
      const stock = inventory.get(line.variantId);

      if (
        !product ||
        !product.active ||
        product.price.currency !== "EUR" ||
        product.price.amountCents < 1 ||
        product.garmentColor !== variant.garmentColor ||
        !publicProduct
      ) {
        throw new Error(`PRODUCT_UNAVAILABLE:${variant.catalogId}`);
      }
      if (!stock) throw new Error(`INVENTORY_NOT_FOUND:${line.variantId}`);
      const available = Math.max(0, stock.onHand - stock.reserved);
      if (available < line.quantity) throw new Error(`OUT_OF_STOCK:${line.variantId}`);

      subtotalCents += product.price.amountCents * line.quantity;
      if (!Number.isSafeInteger(subtotalCents)) throw new Error("ORDER_TOTAL_OVERFLOW");
      orderLines.push({
        variantId: variant.id,
        sku: variant.sku,
        catalogId: variant.catalogId,
        title: publicProduct.title,
        size: variant.size,
        garmentColor: variant.garmentColor,
        quantity: line.quantity,
        unitPrice: product.price,
      });
    }

    const deliveryCents = shippingCents(subtotalCents, input.pricing);
    const totals = calculateGrossOrderTotals({
      subtotalCents,
      shippingCents: deliveryCents,
      vatRateBps: input.pricing.vatRateBps,
    });

    const order: Order = {
      id: orderId,
      customerId: input.customerId,
      email: input.email,
      shippingAddress: input.shippingAddress,
      lines: orderLines,
      totals,
      status: "pending_payment",
      shippingMethod: {
        id: "standard_it",
        label: "Spedizione standard Italia",
        country: "IT",
        price: totals.shipping,
      },
      taxSnapshot: {
        includedInPrices: true,
        rateBps: input.pricing.vatRateBps,
      },
      reservationExpiresAt: expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const inventorySnapshot = inventorySnapshots[index]!;
      const currentInventory = inventorySnapshot.data() as InventorySnapshot;
      transaction.set(inventoryRefs[index]!, {
        ...currentInventory,
        reserved: currentInventory.reserved + line.quantity,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRefs[index]!, {
        id: reservationRefs[index]!.id,
        orderId,
        variantId: line.variantId,
        quantity: line.quantity,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt,
      } satisfies InventoryReservation);
    }

    transaction.set(orderRef, order);
    transaction.set(attemptRef, {
      id: attemptId,
      customerId: input.customerId,
      orderId,
      requestKey: expectedRequestKey,
      status: "pending_payment",
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt,
    } satisfies CheckoutAttempt);

    return order;
  });
}

export async function cancelPendingOrder(input: { customerId: string; orderId: string }): Promise<Order> {
  if (!input.orderId.startsWith("ORD-")) throw new Error("INVALID_ORDER_ID");
  const db = getAdminFirestore();
  const orderRef = db.collection("orders").doc(input.orderId);

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");
    if (order.status === "cancelled") return order;
    if (order.status !== "pending_payment") throw new Error("ORDER_NOT_CANCELLABLE");

    const reservationRefs = order.lines.map((line) => db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)));
    const inventoryRefs = order.lines.map((line) => db.collection(INVENTORY_COLLECTION).doc(line.variantId));
    const [reservationSnapshots, inventorySnapshots] = await Promise.all([
      Promise.all(reservationRefs.map((ref) => transaction.get(ref))),
      Promise.all(inventoryRefs.map((ref) => transaction.get(ref))),
    ]);
    const timestamp = now();

    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const reservationSnapshot = reservationSnapshots[index]!;
      const inventorySnapshot = inventorySnapshots[index]!;
      if (!reservationSnapshot.exists || !inventorySnapshot.exists) continue;
      const reservation = reservationSnapshot.data() as InventoryReservation;
      const currentInventory = inventorySnapshot.data() as InventorySnapshot;
      if (reservation.status !== "active") continue;
      if (reservation.quantity !== line.quantity) throw new Error("RESERVATION_CONFLICT");
      if (currentInventory.reserved < line.quantity) throw new Error("INVENTORY_CORRUPT");

      transaction.set(inventoryRefs[index]!, {
        ...currentInventory,
        reserved: currentInventory.reserved - line.quantity,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRefs[index]!, {
        ...reservation,
        status: "released",
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    }

    const cancelled: Order = { ...order, status: "cancelled", updatedAt: timestamp };
    transaction.set(orderRef, cancelled);

    const idempotencyKey = order.id.slice("ORD-".length);
    if (IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      const attemptRef = db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(`${input.customerId}__${idempotencyKey}`);
      transaction.set(attemptRef, { status: "cancelled", updatedAt: timestamp }, { merge: true });
    }

    return cancelled;
  });
}
