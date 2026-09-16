import type {
  InventoryReservation,
  InventorySnapshot,
  Money,
  Order,
} from "@unsaid/domain";
import {
  INVENTORY_COLLECTION,
  INVENTORY_RESERVATIONS_COLLECTION,
} from "./commerce";
import { getAdminFirestore } from "./firebase";

export const PAYMENT_SESSION_INTENTS_COLLECTION = "paymentSessionIntents";
export const PAYMENTS_COLLECTION = "payments";
export const WEBHOOK_EVENTS_COLLECTION = "webhookEvents";
const CHECKOUT_ATTEMPTS_COLLECTION = "checkoutAttempts";
const ORDERS_COLLECTION = "orders";
const WEBHOOK_GRACE_MINUTES = 5;
const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;
const STRIPE_SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;

export type PaymentSessionIntentStatus =
  | "creating"
  | "ready"
  | "paid"
  | "failed"
  | "expired"
  | "manual_review";

export interface PaymentSessionIntent {
  id: string;
  customerId: string;
  orderId: string;
  provider: "stripe";
  status: PaymentSessionIntentStatus;
  providerSessionId?: string;
  checkoutUrl?: string;
  providerExpiresAt: string;
  holdExpiresAt: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentLifecycleStatus = "requires_action" | "paid" | "failed" | "manual_review";

export interface PaymentLifecycleRecord {
  id: string;
  orderId: string;
  provider: "stripe";
  providerSessionId: string;
  providerPaymentId?: string;
  status: PaymentLifecycleStatus;
  amount: Money;
  createdAt: string;
  updatedAt: string;
}

export interface StripeCheckoutSessionEventData {
  id: string;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
}

interface WebhookEventLedger {
  id: string;
  provider: "stripe";
  type: string;
  outcome: string;
  orderId?: string;
  providerSessionId?: string;
  processedAt: string;
}

function now() {
  return new Date().toISOString();
}

function checkoutKeyFromOrder(orderId: string) {
  return orderId.slice("ORD-".length);
}

function attemptId(customerId: string, orderId: string) {
  return `${customerId}__${checkoutKeyFromOrder(orderId)}`;
}

function reservationId(orderId: string, variantId: string) {
  return `${orderId}__${variantId}`;
}

function paymentId(orderId: string) {
  return `stripe__${orderId}`;
}

function sanitizeErrorCode(value: string) {
  const normalized = value.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120);
  return normalized || "STRIPE_SESSION_CREATE_FAILED";
}

function sessionPaymentIntentId(session: StripeCheckoutSessionEventData) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && typeof session.payment_intent.id === "string") return session.payment_intent.id;
  return undefined;
}

function eventOrderId(session: StripeCheckoutSessionEventData) {
  const metadataOrderId = session.metadata?.order_id;
  if (metadataOrderId && ORDER_ID_PATTERN.test(metadataOrderId)) return metadataOrderId;
  if (session.client_reference_id && ORDER_ID_PATTERN.test(session.client_reference_id)) return session.client_reference_id;
  return null;
}

function checkoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function beginStripePaymentSession(input: {
  customerId: string;
  orderId: string;
  sessionMinutes: number;
}) {
  if (!ORDER_ID_PATTERN.test(input.orderId)) throw new Error("INVALID_ORDER_ID");
  if (!Number.isInteger(input.sessionMinutes) || input.sessionMinutes < 30 || input.sessionMinutes > 120) {
    throw new Error("INVALID_PAYMENT_SESSION_DURATION");
  }

  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(input.orderId);
  const timestamp = now();
  const timestampMs = Date.now();
  const providerExpiresAt = new Date(timestampMs + input.sessionMinutes * 60_000).toISOString();
  const holdExpiresAt = new Date(
    timestampMs + (input.sessionMinutes + WEBHOOK_GRACE_MINUTES) * 60_000,
  ).toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, intentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(intentRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");
    if (order.status !== "pending_payment") throw new Error("ORDER_NOT_PAYABLE");

    if (intentSnapshot.exists) {
      const existing = intentSnapshot.data() as PaymentSessionIntent;
      if (existing.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");
      if (
        existing.status === "ready" &&
        existing.checkoutUrl &&
        existing.providerSessionId &&
        new Date(existing.providerExpiresAt).getTime() > timestampMs
      ) {
        return { order, intent: existing, createProviderSession: false as const };
      }
      if (existing.status === "paid" || existing.status === "manual_review") {
        throw new Error("ORDER_NOT_PAYABLE");
      }
      if (
        existing.status === "creating" &&
        timestampMs - new Date(existing.updatedAt).getTime() < 120_000
      ) {
        throw new Error("PAYMENT_SESSION_IN_PROGRESS");
      }
    }

    if (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= timestampMs) {
      throw new Error("ORDER_RESERVATION_EXPIRED");
    }

    const reservationRefs = order.lines.map((line) =>
      db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)),
    );
    const reservationSnapshots = await Promise.all(reservationRefs.map((ref) => transaction.get(ref)));
    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const snapshot = reservationSnapshots[index]!;
      if (!snapshot.exists) throw new Error("RESERVATION_NOT_FOUND");
      const reservation = snapshot.data() as InventoryReservation;
      if (reservation.status !== "active" || reservation.quantity !== line.quantity) {
        throw new Error("RESERVATION_CONFLICT");
      }
    }

    const intent: PaymentSessionIntent = {
      id: input.orderId,
      customerId: input.customerId,
      orderId: input.orderId,
      provider: "stripe",
      status: "creating",
      providerExpiresAt,
      holdExpiresAt,
      createdAt: intentSnapshot.exists
        ? (intentSnapshot.data() as PaymentSessionIntent).createdAt
        : timestamp,
      updatedAt: timestamp,
    };

    for (let index = 0; index < reservationRefs.length; index += 1) {
      const reservation = reservationSnapshots[index]!.data() as InventoryReservation;
      transaction.set(reservationRefs[index]!, { ...reservation, expiresAt: holdExpiresAt, updatedAt: timestamp });
    }
    transaction.set(orderRef, { ...order, reservationExpiresAt: holdExpiresAt, updatedAt: timestamp });
    transaction.set(
      db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId(input.customerId, input.orderId)),
      { status: "pending_payment", expiresAt: holdExpiresAt, updatedAt: timestamp },
      { merge: true },
    );
    transaction.set(intentRef, intent);

    return { order: { ...order, reservationExpiresAt: holdExpiresAt, updatedAt: timestamp }, intent, createProviderSession: true as const };
  });
}

export async function completeStripePaymentSession(input: {
  customerId: string;
  orderId: string;
  providerSessionId: string;
  checkoutUrl: string;
  providerExpiresAt: string;
}) {
  if (!ORDER_ID_PATTERN.test(input.orderId) || !STRIPE_SESSION_ID_PATTERN.test(input.providerSessionId)) {
    throw new Error("INVALID_PAYMENT_SESSION");
  }
  const normalizedUrl = checkoutUrl(input.checkoutUrl);
  if (!normalizedUrl) throw new Error("INVALID_PAYMENT_SESSION_URL");

  const db = getAdminFirestore();
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(input.orderId);
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(input.orderId));
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const [intentSnapshot, orderSnapshot] = await Promise.all([
      transaction.get(intentRef),
      transaction.get(orderRef),
    ]);
    if (!intentSnapshot.exists || !orderSnapshot.exists) throw new Error("PAYMENT_SESSION_STATE_MISSING");
    const intent = intentSnapshot.data() as PaymentSessionIntent;
    const order = orderSnapshot.data() as Order;
    if (intent.customerId !== input.customerId || order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");

    if (intent.status === "ready" && intent.providerSessionId === input.providerSessionId && intent.checkoutUrl) {
      return intent;
    }
    if (intent.status !== "creating") throw new Error("PAYMENT_SESSION_STATE_CONFLICT");

    const ready: PaymentSessionIntent = {
      ...intent,
      status: "ready",
      providerSessionId: input.providerSessionId,
      checkoutUrl: normalizedUrl,
      providerExpiresAt: input.providerExpiresAt,
      updatedAt: timestamp,
    };
    const payment: PaymentLifecycleRecord = {
      id: paymentRef.id,
      orderId: order.id,
      provider: "stripe",
      providerSessionId: input.providerSessionId,
      status: "requires_action",
      amount: order.totals.total,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(intentRef, ready);
    transaction.set(paymentRef, payment, { merge: true });
    return ready;
  });
}

export async function failStripePaymentSessionStart(input: {
  customerId: string;
  orderId: string;
  errorCode: string;
}) {
  const db = getAdminFirestore();
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(input.orderId);
  const timestamp = now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(intentRef);
    if (!snapshot.exists) return;
    const intent = snapshot.data() as PaymentSessionIntent;
    if (intent.customerId !== input.customerId || intent.status !== "creating") return;
    transaction.set(intentRef, {
      ...intent,
      status: "failed",
      errorCode: sanitizeErrorCode(input.errorCode),
      updatedAt: timestamp,
    } satisfies PaymentSessionIntent);
  });
}

async function cancelOrder(input: {
  customerId: string;
  orderId: string;
  allowExpiredProviderSession: boolean;
}) {
  if (!ORDER_ID_PATTERN.test(input.orderId)) throw new Error("INVALID_ORDER_ID");
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(input.orderId);

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, intentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(intentRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");
    if (order.status === "cancelled") return order;
    if (order.status !== "pending_payment") throw new Error("ORDER_NOT_CANCELLABLE");

    const intent = intentSnapshot.exists ? (intentSnapshot.data() as PaymentSessionIntent) : null;
    if (intent && ["paid", "manual_review"].includes(intent.status)) throw new Error("PAYMENT_SESSION_ACTIVE");
    if (intent && ["creating", "ready"].includes(intent.status)) {
      const expired = new Date(intent.holdExpiresAt).getTime() <= Date.now();
      if (!input.allowExpiredProviderSession || !expired) throw new Error("PAYMENT_SESSION_ACTIVE");
    }

    const reservationRefs = order.lines.map((line) =>
      db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)),
    );
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
      if (!reservationSnapshot.exists || !inventorySnapshot.exists) throw new Error("RESERVATION_STATE_MISSING");
      const reservation = reservationSnapshot.data() as InventoryReservation;
      const inventory = inventorySnapshot.data() as InventorySnapshot;
      if (reservation.status !== "active" || reservation.quantity !== line.quantity) throw new Error("RESERVATION_CONFLICT");
      if (inventory.reserved < line.quantity) throw new Error("INVENTORY_CORRUPT");
    }

    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const reservation = reservationSnapshots[index]!.data() as InventoryReservation;
      const inventory = inventorySnapshots[index]!.data() as InventorySnapshot;
      transaction.set(inventoryRefs[index]!, {
        ...inventory,
        reserved: inventory.reserved - line.quantity,
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
    transaction.set(
      db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId(input.customerId, input.orderId)),
      { status: "cancelled", updatedAt: timestamp },
      { merge: true },
    );
    if (intent) {
      transaction.set(intentRef, { ...intent, status: "expired", updatedAt: timestamp } satisfies PaymentSessionIntent);
    }
    return cancelled;
  });
}

export function cancelPendingOrderWithPaymentGuard(input: { customerId: string; orderId: string }) {
  return cancelOrder({ ...input, allowExpiredProviderSession: false });
}

export function releaseExpiredPendingOrder(input: { customerId: string; orderId: string }) {
  return cancelOrder({ ...input, allowExpiredProviderSession: true });
}

function manualReviewReason(input: {
  order: Order;
  intent: PaymentSessionIntent;
  session: StripeCheckoutSessionEventData;
  reservationSnapshots: readonly { exists: boolean; data(): unknown }[];
  inventorySnapshots: readonly { exists: boolean; data(): unknown }[];
}) {
  if (input.intent.providerSessionId !== input.session.id) return "provider_session_mismatch";
  if (input.session.payment_status !== "paid") return "provider_not_paid";
  if (input.session.currency?.toLowerCase() !== "eur") return "currency_mismatch";
  if (input.session.amount_total !== input.order.totals.total.amountCents) return "amount_mismatch";

  for (let index = 0; index < input.order.lines.length; index += 1) {
    const line = input.order.lines[index]!;
    const reservationSnapshot = input.reservationSnapshots[index]!;
    const inventorySnapshot = input.inventorySnapshots[index]!;
    if (!reservationSnapshot.exists || !inventorySnapshot.exists) return "reservation_state_missing";
    const reservation = reservationSnapshot.data() as InventoryReservation;
    const inventory = inventorySnapshot.data() as InventorySnapshot;
    if (reservation.status !== "active" || reservation.quantity !== line.quantity) return "reservation_conflict";
    if (inventory.reserved < line.quantity || inventory.onHand < line.quantity) return "inventory_conflict";
  }
  return null;
}

export async function applyStripeCheckoutPaid(input: {
  eventId: string;
  eventType: string;
  session: StripeCheckoutSessionEventData;
}) {
  const orderId = eventOrderId(input.session);
  const db = getAdminFirestore();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(input.eventId);
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return { duplicate: true, outcome: "duplicate" };

    if (!orderId || !STRIPE_SESSION_ID_PATTERN.test(input.session.id)) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_unmatched",
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_unmatched" };
    }

    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(orderId);
    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(orderId));
    const [orderSnapshot, intentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(intentRef),
    ]);
    if (!orderSnapshot.exists || !intentSnapshot.exists) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_state_missing",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_state_missing" };
    }

    const order = orderSnapshot.data() as Order;
    const intent = intentSnapshot.data() as PaymentSessionIntent;
    if (order.status === "paid" && intent.status === "paid") {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "already_paid",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "already_paid" };
    }
    if (order.status !== "pending_payment") {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_order_state",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_order_state" };
    }

    const reservationRefs = order.lines.map((line) =>
      db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)),
    );
    const inventoryRefs = order.lines.map((line) => db.collection(INVENTORY_COLLECTION).doc(line.variantId));
    const [reservationSnapshots, inventorySnapshots] = await Promise.all([
      Promise.all(reservationRefs.map((ref) => transaction.get(ref))),
      Promise.all(inventoryRefs.map((ref) => transaction.get(ref))),
    ]);

    const reviewReason = manualReviewReason({
      order,
      intent,
      session: input.session,
      reservationSnapshots,
      inventorySnapshots,
    });
    const providerPaymentId = sessionPaymentIntentId(input.session);

    if (reviewReason) {
      transaction.set(intentRef, {
        ...intent,
        status: "manual_review",
        errorCode: reviewReason,
        updatedAt: timestamp,
      } satisfies PaymentSessionIntent);
      transaction.set(paymentRef, {
        id: paymentRef.id,
        orderId,
        provider: "stripe",
        providerSessionId: input.session.id,
        ...(providerPaymentId ? { providerPaymentId } : {}),
        status: "manual_review",
        amount: order.totals.total,
        createdAt: timestamp,
        updatedAt: timestamp,
      } satisfies PaymentLifecycleRecord, { merge: true });
      transaction.set(orderRef, { updatedAt: timestamp, paymentReview: { reason: reviewReason, eventId: input.eventId } }, { merge: true });
      transaction.set(
        db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId(order.customerId, order.id)),
        { status: "payment_review", updatedAt: timestamp },
        { merge: true },
      );
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: `manual_review:${reviewReason}`,
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "manual_review", reviewReason };
    }

    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const reservation = reservationSnapshots[index]!.data() as InventoryReservation;
      const inventory = inventorySnapshots[index]!.data() as InventorySnapshot;
      transaction.set(inventoryRefs[index]!, {
        ...inventory,
        onHand: inventory.onHand - line.quantity,
        reserved: inventory.reserved - line.quantity,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRefs[index]!, {
        ...reservation,
        status: "committed",
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    }

    transaction.set(orderRef, { ...order, status: "paid", updatedAt: timestamp });
    transaction.set(intentRef, { ...intent, status: "paid", updatedAt: timestamp } satisfies PaymentSessionIntent);
    transaction.set(paymentRef, {
      id: paymentRef.id,
      orderId,
      provider: "stripe",
      providerSessionId: input.session.id,
      ...(providerPaymentId ? { providerPaymentId } : {}),
      status: "paid",
      amount: order.totals.total,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies PaymentLifecycleRecord, { merge: true });
    transaction.set(
      db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId(order.customerId, order.id)),
      { status: "paid", updatedAt: timestamp },
      { merge: true },
    );
    transaction.set(eventRef, {
      id: input.eventId,
      provider: "stripe",
      type: input.eventType,
      outcome: "paid",
      orderId,
      providerSessionId: input.session.id,
      processedAt: timestamp,
    } satisfies WebhookEventLedger);
    return { duplicate: false, outcome: "paid" };
  });
}

export async function applyStripeCheckoutExpired(input: {
  eventId: string;
  eventType: string;
  session: StripeCheckoutSessionEventData;
}) {
  const orderId = eventOrderId(input.session);
  const db = getAdminFirestore();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(input.eventId);
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return { duplicate: true, outcome: "duplicate" };
    if (!orderId || !STRIPE_SESSION_ID_PATTERN.test(input.session.id)) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_unmatched",
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_unmatched" };
    }

    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(orderId);
    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(orderId));
    const [orderSnapshot, intentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(intentRef),
    ]);
    if (!orderSnapshot.exists || !intentSnapshot.exists) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_state_missing",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_state_missing" };
    }

    const order = orderSnapshot.data() as Order;
    const intent = intentSnapshot.data() as PaymentSessionIntent;
    if (intent.providerSessionId !== input.session.id || intent.status === "manual_review" || intent.status === "paid" || order.status === "paid") {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_protected_state",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_protected_state" };
    }
    if (order.status !== "pending_payment") {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_order_state",
        orderId,
        providerSessionId: input.session.id,
        processedAt: timestamp,
      } satisfies WebhookEventLedger);
      return { duplicate: false, outcome: "ignored_order_state" };
    }

    const reservationRefs = order.lines.map((line) =>
      db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)),
    );
    const inventoryRefs = order.lines.map((line) => db.collection(INVENTORY_COLLECTION).doc(line.variantId));
    const [reservationSnapshots, inventorySnapshots] = await Promise.all([
      Promise.all(reservationRefs.map((ref) => transaction.get(ref))),
      Promise.all(inventoryRefs.map((ref) => transaction.get(ref))),
    ]);

    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const reservationSnapshot = reservationSnapshots[index]!;
      const inventorySnapshot = inventorySnapshots[index]!;
      if (!reservationSnapshot.exists || !inventorySnapshot.exists) throw new Error("RESERVATION_STATE_MISSING");
      const reservation = reservationSnapshot.data() as InventoryReservation;
      const inventory = inventorySnapshot.data() as InventorySnapshot;
      if (reservation.status !== "active" || reservation.quantity !== line.quantity || inventory.reserved < line.quantity) {
        throw new Error("RESERVATION_CONFLICT");
      }
    }

    for (let index = 0; index < order.lines.length; index += 1) {
      const line = order.lines[index]!;
      const reservation = reservationSnapshots[index]!.data() as InventoryReservation;
      const inventory = inventorySnapshots[index]!.data() as InventorySnapshot;
      transaction.set(inventoryRefs[index]!, {
        ...inventory,
        reserved: inventory.reserved - line.quantity,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRefs[index]!, {
        ...reservation,
        status: "released",
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    }

    transaction.set(orderRef, { ...order, status: "cancelled", updatedAt: timestamp });
    transaction.set(intentRef, { ...intent, status: "expired", updatedAt: timestamp } satisfies PaymentSessionIntent);
    transaction.set(paymentRef, {
      id: paymentRef.id,
      orderId,
      provider: "stripe",
      providerSessionId: input.session.id,
      status: "failed",
      amount: order.totals.total,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies PaymentLifecycleRecord, { merge: true });
    transaction.set(
      db.collection(CHECKOUT_ATTEMPTS_COLLECTION).doc(attemptId(order.customerId, order.id)),
      { status: "cancelled", updatedAt: timestamp },
      { merge: true },
    );
    transaction.set(eventRef, {
      id: input.eventId,
      provider: "stripe",
      type: input.eventType,
      outcome: "expired",
      orderId,
      providerSessionId: input.session.id,
      processedAt: timestamp,
    } satisfies WebhookEventLedger);
    return { duplicate: false, outcome: "expired" };
  });
}
