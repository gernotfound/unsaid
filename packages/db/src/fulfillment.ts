import type { Order, ShipmentRecord } from "@unsaid/domain";
import { getAdminFirestore } from "./firebase";
import {
  buildShipmentConfirmationEmail,
  EMAIL_OUTBOX_COLLECTION,
  shipmentConfirmationOutboxId,
  type EmailOutboxRecord,
  type NotificationShipment,
} from "./notifications";
import { PAYMENTS_COLLECTION, type PaymentLifecycleRecord } from "./payments";

export const SHIPMENTS_COLLECTION = "shipments";
const ORDERS_COLLECTION = "orders";
const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;

export interface FulfillmentShipmentRecord extends ShipmentRecord {
  customerId: string;
  trackingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderFulfillment {
  orderId: string;
  shipment: FulfillmentShipmentRecord | null;
}

function paymentId(orderId: string) {
  return `stripe__${orderId}`;
}

function shipmentId(orderId: string) {
  return `shipment__${orderId}`;
}

function validateOrderId(orderId: string) {
  if (!ORDER_ID_PATTERN.test(orderId)) throw new Error("INVALID_ORDER_ID");
}

function normalizeProvider(value: string) {
  const provider = value.trim().replace(/\s+/g, " ");
  if (provider.length < 2 || provider.length > 80) throw new Error("INVALID_SHIPMENT_PROVIDER");
  if (!/^[\p{L}\p{N} ._&'()/-]+$/u.test(provider)) throw new Error("INVALID_SHIPMENT_PROVIDER");
  return provider;
}

function normalizeTrackingCode(value: string) {
  const trackingCode = value.trim();
  if (trackingCode.length < 3 || trackingCode.length > 120) throw new Error("INVALID_TRACKING_CODE");
  if (!/^[A-Za-z0-9 ._/-]+$/.test(trackingCode)) throw new Error("INVALID_TRACKING_CODE");
  return trackingCode;
}

function normalizeTrackingUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.length > 500) throw new Error("INVALID_TRACKING_URL");
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("INVALID_TRACKING_URL");
    return url.toString();
  } catch {
    throw new Error("INVALID_TRACKING_URL");
  }
}

export async function getShipmentForOrder(orderId: string): Promise<FulfillmentShipmentRecord | null> {
  validateOrderId(orderId);
  const snapshot = await getAdminFirestore().collection(SHIPMENTS_COLLECTION).doc(shipmentId(orderId)).get();
  return snapshot.exists ? (snapshot.data() as FulfillmentShipmentRecord) : null;
}

export async function listCustomerOrderFulfillment(
  customerId: string,
  orders: readonly Pick<Order, "id" | "customerId">[],
): Promise<readonly CustomerOrderFulfillment[]> {
  const owned = orders.filter((order) => order.customerId === customerId);
  if (!owned.length) return [];
  const db = getAdminFirestore();
  const refs = owned.map((order) => db.collection(SHIPMENTS_COLLECTION).doc(shipmentId(order.id)));
  const snapshots = await db.getAll(...refs);
  return owned.map((order, index) => ({
    orderId: order.id,
    shipment: snapshots[index]?.exists
      ? (snapshots[index]!.data() as FulfillmentShipmentRecord)
      : null,
  }));
}

export async function prepareShipment(input: {
  orderId: string;
  provider: string;
  trackingCode?: string;
  trackingUrl?: string;
}): Promise<FulfillmentShipmentRecord> {
  validateOrderId(input.orderId);
  const provider = normalizeProvider(input.provider);
  const trackingCode = input.trackingCode?.trim() ? normalizeTrackingCode(input.trackingCode) : undefined;
  const trackingUrl = normalizeTrackingUrl(input.trackingUrl);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(input.orderId));
  const shipmentRef = db.collection(SHIPMENTS_COLLECTION).doc(shipmentId(input.orderId));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot, shipmentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(shipmentRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.status !== "processing") throw new Error("ORDER_NOT_READY_FOR_SHIPMENT");
    if (!paymentSnapshot.exists || (paymentSnapshot.data() as PaymentLifecycleRecord).status !== "paid") {
      throw new Error("PAYMENT_NOT_CONFIRMED");
    }

    const existing = shipmentSnapshot.exists
      ? (shipmentSnapshot.data() as FulfillmentShipmentRecord)
      : null;
    if (existing && ["shipped", "delivered", "returned"].includes(existing.status)) {
      throw new Error("SHIPMENT_ALREADY_DISPATCHED");
    }

    const shipment: FulfillmentShipmentRecord = {
      id: shipmentRef.id,
      orderId: order.id,
      customerId: order.customerId,
      provider,
      ...(trackingCode ? { trackingCode } : {}),
      ...(trackingUrl ? { trackingUrl } : {}),
      status: "ready",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    transaction.set(shipmentRef, shipment);
    return shipment;
  });
}

export async function markShipmentShipped(input: {
  orderId: string;
  provider: string;
  trackingCode: string;
  trackingUrl?: string;
}): Promise<FulfillmentShipmentRecord> {
  validateOrderId(input.orderId);
  const provider = normalizeProvider(input.provider);
  const trackingCode = normalizeTrackingCode(input.trackingCode);
  const trackingUrl = normalizeTrackingUrl(input.trackingUrl);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(input.orderId));
  const shipmentRef = db.collection(SHIPMENTS_COLLECTION).doc(shipmentId(input.orderId));
  const outboxRef = db.collection(EMAIL_OUTBOX_COLLECTION).doc(shipmentConfirmationOutboxId(input.orderId));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot, shipmentSnapshot, outboxSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(shipmentRef),
      transaction.get(outboxRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.status === "shipped" && shipmentSnapshot.exists) {
      return shipmentSnapshot.data() as FulfillmentShipmentRecord;
    }
    if (order.status !== "processing") throw new Error("ORDER_NOT_READY_FOR_SHIPMENT");
    if (!paymentSnapshot.exists || (paymentSnapshot.data() as PaymentLifecycleRecord).status !== "paid") {
      throw new Error("PAYMENT_NOT_CONFIRMED");
    }

    const existing = shipmentSnapshot.exists
      ? (shipmentSnapshot.data() as FulfillmentShipmentRecord)
      : null;
    if (existing?.status === "delivered" || existing?.status === "returned") {
      throw new Error("SHIPMENT_STATE_CONFLICT");
    }

    const shipment: FulfillmentShipmentRecord = {
      id: shipmentRef.id,
      orderId: order.id,
      customerId: order.customerId,
      provider,
      trackingCode,
      ...(trackingUrl ? { trackingUrl } : {}),
      status: "shipped",
      shippedAt: timestamp,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const shippedOrder: Order = { ...order, status: "shipped", updatedAt: timestamp };
    transaction.set(shipmentRef, shipment);
    transaction.set(orderRef, shippedOrder);
    if (!outboxSnapshot.exists) {
      transaction.set(
        outboxRef,
        buildShipmentConfirmationEmail(shippedOrder, shipment as NotificationShipment, timestamp),
      );
    }
    return shipment;
  });
}

export async function markShipmentDelivered(orderId: string): Promise<FulfillmentShipmentRecord> {
  validateOrderId(orderId);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
  const shipmentRef = db.collection(SHIPMENTS_COLLECTION).doc(shipmentId(orderId));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, shipmentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(shipmentRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    if (!shipmentSnapshot.exists) throw new Error("SHIPMENT_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    const shipment = shipmentSnapshot.data() as FulfillmentShipmentRecord;
    if (order.status === "delivered" && shipment.status === "delivered") return shipment;
    if (order.status !== "shipped" || shipment.status !== "shipped") {
      throw new Error("SHIPMENT_NOT_READY_FOR_DELIVERY");
    }

    const deliveredShipment: FulfillmentShipmentRecord = {
      ...shipment,
      status: "delivered",
      deliveredAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(shipmentRef, deliveredShipment);
    transaction.set(orderRef, { ...order, status: "delivered", updatedAt: timestamp } satisfies Order);
    return deliveredShipment;
  });
}

export async function listOrderNotifications(orderId: string): Promise<readonly EmailOutboxRecord[]> {
  validateOrderId(orderId);
  const snapshot = await getAdminFirestore()
    .collection(EMAIL_OUTBOX_COLLECTION)
    .where("orderId", "==", orderId)
    .limit(20)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as EmailOutboxRecord)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
