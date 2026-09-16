import type { Money, OrderStatus } from "@unsaid/domain";
import {
  PAYMENTS_COLLECTION,
  PAYMENT_SESSION_INTENTS_COLLECTION,
  type PaymentLifecycleRecord,
  type PaymentLifecycleStatus,
  type PaymentSessionIntent,
  type PaymentSessionIntentStatus,
} from "./payments";
import { getAdminFirestore } from "./firebase";

const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;
const ORDERS_COLLECTION = "orders";

export interface CustomerPaymentStatusSnapshot {
  orderId: string;
  orderStatus: OrderStatus;
  total: Money;
  paymentStatus: PaymentLifecycleStatus | null;
  intentStatus: PaymentSessionIntentStatus | null;
  updatedAt: string;
  reservationExpiresAt?: string;
  providerExpiresAt?: string;
}

export async function getCustomerPaymentStatus(input: {
  customerId: string;
  orderId: string;
}): Promise<CustomerPaymentStatusSnapshot> {
  if (!ORDER_ID_PATTERN.test(input.orderId)) throw new Error("INVALID_ORDER_ID");

  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const intentRef = db.collection(PAYMENT_SESSION_INTENTS_COLLECTION).doc(input.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(`stripe__${input.orderId}`);
  const [orderSnapshot, intentSnapshot, paymentSnapshot] = await Promise.all([
    orderRef.get(),
    intentRef.get(),
    paymentRef.get(),
  ]);

  if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
  const order = orderSnapshot.data() as {
    id: string;
    customerId: string;
    status: OrderStatus;
    totals: { total: Money };
    updatedAt: string;
    reservationExpiresAt?: string;
  };
  if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");

  const intent = intentSnapshot.exists ? (intentSnapshot.data() as PaymentSessionIntent) : null;
  const payment = paymentSnapshot.exists ? (paymentSnapshot.data() as PaymentLifecycleRecord) : null;
  const updatedAt = [order.updatedAt, intent?.updatedAt, payment?.updatedAt]
    .filter((value): value is string => typeof value === "string")
    .sort()
    .at(-1) ?? order.updatedAt;

  return {
    orderId: order.id,
    orderStatus: order.status,
    total: order.totals.total,
    paymentStatus: payment?.status ?? null,
    intentStatus: intent?.status ?? null,
    updatedAt,
    ...(order.reservationExpiresAt ? { reservationExpiresAt: order.reservationExpiresAt } : {}),
    ...(intent?.providerExpiresAt ? { providerExpiresAt: intent.providerExpiresAt } : {}),
  };
}
