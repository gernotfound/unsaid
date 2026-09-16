import type { InventoryReservation, Money, Order, OrderStatus } from "@unsaid/domain";
import { INVENTORY_RESERVATIONS_COLLECTION } from "./commerce";
import { getAdminFirestore } from "./firebase";
import {
  PAYMENTS_COLLECTION,
  PAYMENT_SESSION_INTENTS_COLLECTION,
  type PaymentLifecycleRecord,
  type PaymentSessionIntent,
} from "./payments";

const ORDERS_COLLECTION = "orders";
export const REFUND_CASES_COLLECTION = "refundCases";
const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

export type RefundCaseStatus = "requested" | "approved" | "rejected" | "processed";

export interface RefundCaseRecord {
  id: string;
  orderId: string;
  customerId: string;
  paymentId: string;
  amount: Money;
  reason: string;
  status: RefundCaseStatus;
  providerAction: "not_executed" | "executed";
  requestedByAdminUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderListItem {
  order: Order;
  payment: PaymentLifecycleRecord | null;
  paymentIntent: PaymentSessionIntent | null;
  reviewReason: string | null;
}

export interface AdminOrderPage {
  items: AdminOrderListItem[];
  nextCursor: string | null;
}

export interface AdminOrderDetail extends AdminOrderListItem {
  reservations: InventoryReservation[];
  refundCases: RefundCaseRecord[];
}

type OrderWithReview = Order & {
  paymentReview?: { reason?: string; eventId?: string };
};

function reviewReason(order: Order) {
  const value = (order as OrderWithReview).paymentReview?.reason;
  return typeof value === "string" && value ? value : null;
}

function paymentId(orderId: string) {
  return `stripe__${orderId}`;
}

function reservationId(orderId: string, variantId: string) {
  return `${orderId}__${variantId}`;
}

function validateOrderId(orderId: string) {
  if (!ORDER_ID_PATTERN.test(orderId)) throw new Error("INVALID_ORDER_ID");
}

export async function listAdminOrdersPage(input: {
  afterCreatedAt?: string;
  limit?: number;
} = {}): Promise<AdminOrderPage> {
  const db = getAdminFirestore();
  const limit = Math.min(50, Math.max(1, input.limit ?? 25));
  let query = db.collection(ORDERS_COLLECTION).orderBy("createdAt", "desc").limit(limit + 1);
  if (input.afterCreatedAt) query = query.startAfter(input.afterCreatedAt);

  const snapshot = await query.get();
  const visible = snapshot.docs.slice(0, limit);
  const orders = visible.map((doc) => doc.data() as Order);
  if (!orders.length) return { items: [], nextCursor: null };

  const paymentRefs = orders.map((order) => db.collection(PAYMENTS_COLLECTION).doc(paymentId(order.id)));
  const intentRefs = orders.map((order) => db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(order.id));
  const [paymentSnapshots, intentSnapshots] = await Promise.all([
    db.getAll(...paymentRefs),
    db.getAll(...intentRefs),
  ]);

  const items = orders.map((order, index) => ({
    order,
    payment: paymentSnapshots[index]?.exists
      ? (paymentSnapshots[index]!.data() as PaymentLifecycleRecord)
      : null,
    paymentIntent: intentSnapshots[index]?.exists
      ? (intentSnapshots[index]!.data() as PaymentSessionIntent)
      : null,
    reviewReason: reviewReason(order),
  }));
  const nextCursor = snapshot.docs.length > limit
    ? orders.at(-1)?.createdAt ?? null
    : null;
  return { items, nextCursor };
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail> {
  validateOrderId(orderId);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(orderId));
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(orderId);
  const [orderSnapshot, paymentSnapshot, intentSnapshot, refundsSnapshot] = await Promise.all([
    orderRef.get(),
    paymentRef.get(),
    intentRef.get(),
    db.collection(REFUND_CASES_COLLECTION).where("orderId", "==", orderId).limit(20).get(),
  ]);
  if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");

  const order = orderSnapshot.data() as Order;
  const reservationRefs = order.lines.map((line) =>
    db.collection(INVENTORY_RESERVATIONS_COLLECTION).doc(reservationId(order.id, line.variantId)),
  );
  const reservationSnapshots = reservationRefs.length ? await db.getAll(...reservationRefs) : [];

  return {
    order,
    payment: paymentSnapshot.exists ? (paymentSnapshot.data() as PaymentLifecycleRecord) : null,
    paymentIntent: intentSnapshot.exists ? (intentSnapshot.data() as PaymentSessionIntent) : null,
    reviewReason: reviewReason(order),
    reservations: reservationSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.data() as InventoryReservation),
    refundCases: refundsSnapshot.docs
      .map((doc) => doc.data() as RefundCaseRecord)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function markAdminOrderProcessing(orderId: string) {
  validateOrderId(orderId);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(orderId));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.status === "processing") return order;
    if (order.status !== "paid") throw new Error("ORDER_NOT_READY_FOR_PROCESSING");
    if (!paymentSnapshot.exists || (paymentSnapshot.data() as PaymentLifecycleRecord).status !== "paid") {
      throw new Error("PAYMENT_NOT_CONFIRMED");
    }
    const updated: Order = { ...order, status: "processing", updatedAt: timestamp };
    transaction.set(orderRef, updated);
    return updated;
  });
}

export async function createRefundCase(input: {
  orderId: string;
  adminUid: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
}): Promise<RefundCaseRecord> {
  validateOrderId(input.orderId);
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) throw new Error("INVALID_REFUND_AMOUNT");
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("INVALID_REFUND_REASON");

  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(input.orderId));
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(`${input.orderId}__${input.idempotencyKey}`);
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot, refundSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(refundRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (!["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_REFUND_ELIGIBLE");
    }
    if (!paymentSnapshot.exists) throw new Error("PAYMENT_NOT_FOUND");
    const payment = paymentSnapshot.data() as PaymentLifecycleRecord;
    if (payment.status !== "paid") throw new Error("PAYMENT_NOT_REFUND_ELIGIBLE");
    if (input.amountCents > payment.amount.amountCents || input.amountCents > order.totals.total.amountCents) {
      throw new Error("REFUND_AMOUNT_EXCEEDS_PAYMENT");
    }

    if (refundSnapshot.exists) {
      const existing = refundSnapshot.data() as RefundCaseRecord;
      if (existing.amount.amountCents !== input.amountCents || existing.reason !== reason) {
        throw new Error("REFUND_IDEMPOTENCY_CONFLICT");
      }
      return existing;
    }

    const refundCase: RefundCaseRecord = {
      id: refundRef.id,
      orderId: order.id,
      customerId: order.customerId,
      paymentId: payment.id,
      amount: { amountCents: input.amountCents, currency: "EUR" },
      reason,
      status: "requested",
      providerAction: "not_executed",
      requestedByAdminUid: input.adminUid,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(refundRef, refundCase);
    return refundCase;
  });
}

export function adminOrderStatusCounts(items: readonly AdminOrderListItem[]) {
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const item of items) counts[item.order.status] = (counts[item.order.status] ?? 0) + 1;
  return counts;
}
