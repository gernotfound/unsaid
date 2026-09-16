import type { Money, Order } from "@unsaid/domain";
import { getAdminFirestore } from "./firebase";
import { PAYMENTS_COLLECTION, WEBHOOK_EVENTS_COLLECTION, type PaymentLifecycleRecord } from "./payments";

const ORDERS_COLLECTION = "orders";
const REFUND_CASES_COLLECTION = "refundCases";
const REFUND_CONTROLS_COLLECTION = "refundControls";
const REFUND_CASE_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}__[A-Za-z0-9_-]{8,80}$/;
const PROVIDER_REFUND_ID_PATTERN = /^re_[A-Za-z0-9_]+$/;
const PROVIDER_PAYMENT_ID_PATTERN = /^pi_[A-Za-z0-9_]+$/;

export type RefundExecutionState =
  | "idle"
  | "locked"
  | "provider_created"
  | "manual_review"
  | "complete"
  | "failed";

export type StripeRefundProviderStatus =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "canceled";

export interface ExecutableRefundCase {
  id: string;
  orderId: string;
  customerId: string;
  paymentId: string;
  amount: Money;
  reason: string;
  status: string;
  providerAction: string;
  requestedByAdminUid: string;
  createdAt: string;
  updatedAt: string;
  executionState?: RefundExecutionState;
  executedByAdminUid?: string;
  providerRefundId?: string;
  providerStatus?: StripeRefundProviderStatus;
  providerFailureCode?: string;
  executedAt?: string;
}

export interface RefundControlRecord {
  orderId: string;
  paymentAmountCents: number;
  refundedCents: number;
  inFlightCents: number;
  updatedAt: string;
}

export interface AdminRefundListItem {
  refundCase: ExecutableRefundCase;
  order: Order | null;
  payment: PaymentLifecycleRecord | null;
}

export interface StripeRefundEventData {
  id: string;
  status?: string | null;
  amount?: number | null;
  payment_intent?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, string> | null;
}

function paymentId(orderId: string) {
  return `stripe__${orderId}`;
}

function now() {
  return new Date().toISOString();
}

function validateRefundCaseId(refundCaseId: string) {
  if (!REFUND_CASE_ID_PATTERN.test(refundCaseId)) throw new Error("INVALID_REFUND_CASE_ID");
}

function normalizeProviderStatus(value: string | null | undefined): StripeRefundProviderStatus | null {
  if (value === "pending" || value === "requires_action" || value === "succeeded" || value === "failed" || value === "canceled") {
    return value;
  }
  return null;
}

function controlFor(order: Order, existing: RefundControlRecord | null, timestamp: string): RefundControlRecord {
  return existing ?? {
    orderId: order.id,
    paymentAmountCents: order.totals.total.amountCents,
    refundedCents: 0,
    inFlightCents: 0,
    updatedAt: timestamp,
  };
}

export async function listAdminRefundCases(limitInput = 50): Promise<readonly AdminRefundListItem[]> {
  const db = getAdminFirestore();
  const limit = Math.min(100, Math.max(1, Math.trunc(limitInput)));
  const snapshot = await db.collection(REFUND_CASES_COLLECTION).orderBy("createdAt", "desc").limit(limit).get();
  const refundCases = snapshot.docs.map((doc) => doc.data() as ExecutableRefundCase);
  if (!refundCases.length) return [];

  const orderRefs = refundCases.map((refundCase) => db.collection(ORDERS_COLLECTION).doc(refundCase.orderId));
  const paymentRefs = refundCases.map((refundCase) => db.collection(PAYMENTS_COLLECTION).doc(paymentId(refundCase.orderId)));
  const [orderSnapshots, paymentSnapshots] = await Promise.all([
    db.getAll(...orderRefs),
    db.getAll(...paymentRefs),
  ]);

  return refundCases.map((refundCase, index) => ({
    refundCase,
    order: orderSnapshots[index]?.exists ? (orderSnapshots[index]!.data() as Order) : null,
    payment: paymentSnapshots[index]?.exists
      ? (paymentSnapshots[index]!.data() as PaymentLifecycleRecord)
      : null,
  }));
}

export async function beginStripeRefundExecution(input: {
  refundCaseId: string;
  adminUid: string;
}) {
  validateRefundCaseId(input.refundCaseId);
  const db = getAdminFirestore();
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
    const refundCase = refundSnapshot.data() as ExecutableRefundCase;
    const orderRef = db.collection(ORDERS_COLLECTION).doc(refundCase.orderId);
    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(refundCase.orderId));
    const controlRef = db.collection(REFUND_CONTROLS_COLLECTION).doc(refundCase.orderId);
    const [orderSnapshot, paymentSnapshot, controlSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(controlRef),
    ]);

    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    if (!paymentSnapshot.exists) throw new Error("PAYMENT_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    const payment = paymentSnapshot.data() as PaymentLifecycleRecord;
    if (!["paid", "processing", "shipped", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_REFUND_ELIGIBLE");
    }
    if (payment.status !== "paid") throw new Error("PAYMENT_NOT_REFUND_ELIGIBLE");
    if (!payment.providerPaymentId || !PROVIDER_PAYMENT_ID_PATTERN.test(payment.providerPaymentId)) {
      throw new Error("PAYMENT_PROVIDER_ID_MISSING");
    }
    if (refundCase.executionState === "complete") throw new Error("REFUND_ALREADY_COMPLETE");
    if (["locked", "provider_created", "manual_review"].includes(refundCase.executionState ?? "idle")) {
      throw new Error("REFUND_EXECUTION_ALREADY_ACTIVE");
    }
    if (refundCase.status !== "requested" && refundCase.status !== "rejected") {
      throw new Error("REFUND_NOT_EXECUTABLE");
    }

    const control = controlFor(
      order,
      controlSnapshot.exists ? (controlSnapshot.data() as RefundControlRecord) : null,
      timestamp,
    );
    if (control.paymentAmountCents !== payment.amount.amountCents) throw new Error("REFUND_CONTROL_AMOUNT_MISMATCH");
    if (control.refundedCents + control.inFlightCents + refundCase.amount.amountCents > payment.amount.amountCents) {
      throw new Error("REFUND_AMOUNT_EXCEEDS_REMAINING");
    }

    const locked: ExecutableRefundCase = {
      ...refundCase,
      status: "approved",
      providerAction: "not_executed",
      executionState: "locked",
      executedByAdminUid: input.adminUid,
      updatedAt: timestamp,
    };
    transaction.set(refundRef, locked);
    transaction.set(controlRef, {
      ...control,
      inFlightCents: control.inFlightCents + refundCase.amount.amountCents,
      updatedAt: timestamp,
    } satisfies RefundControlRecord);

    return {
      refundCase: locked,
      order,
      paymentIntentId: payment.providerPaymentId,
      amountCents: refundCase.amount.amountCents,
    };
  });
}

export async function recordStripeRefundProviderResponse(input: {
  refundCaseId: string;
  providerRefundId: string;
  providerStatus: StripeRefundProviderStatus;
  failureCode?: string;
}) {
  validateRefundCaseId(input.refundCaseId);
  if (!PROVIDER_REFUND_ID_PATTERN.test(input.providerRefundId)) throw new Error("INVALID_PROVIDER_REFUND_ID");
  const db = getAdminFirestore();
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
    const refundCase = refundSnapshot.data() as ExecutableRefundCase;
    const orderRef = db.collection(ORDERS_COLLECTION).doc(refundCase.orderId);
    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(refundCase.orderId));
    const controlRef = db.collection(REFUND_CONTROLS_COLLECTION).doc(refundCase.orderId);
    const [orderSnapshot, paymentSnapshot, controlSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(controlRef),
    ]);
    if (!orderSnapshot.exists || !paymentSnapshot.exists || !controlSnapshot.exists) {
      throw new Error("REFUND_STATE_MISSING");
    }
    const order = orderSnapshot.data() as Order;
    const payment = paymentSnapshot.data() as PaymentLifecycleRecord;
    const control = controlSnapshot.data() as RefundControlRecord;
    const amount = refundCase.amount.amountCents;

    if (refundCase.executionState === "complete" && refundCase.providerRefundId === input.providerRefundId) {
      return refundCase;
    }
    if (refundCase.executionState !== "locked" && refundCase.executionState !== "provider_created" && refundCase.executionState !== "manual_review") {
      throw new Error("REFUND_EXECUTION_STATE_CONFLICT");
    }

    if (input.providerStatus === "succeeded") {
      const nextRefunded = control.refundedCents + amount;
      const nextInFlight = Math.max(0, control.inFlightCents - amount);
      const complete: ExecutableRefundCase = {
        ...refundCase,
        status: "processed",
        providerAction: "executed",
        executionState: "complete",
        providerRefundId: input.providerRefundId,
        providerStatus: "succeeded",
        executedAt: timestamp,
        updatedAt: timestamp,
      };
      transaction.set(refundRef, complete);
      transaction.set(controlRef, {
        ...control,
        refundedCents: nextRefunded,
        inFlightCents: nextInFlight,
        updatedAt: timestamp,
      } satisfies RefundControlRecord);
      transaction.set(paymentRef, {
        refundedAmount: { amountCents: nextRefunded, currency: "EUR" },
        ...(nextRefunded >= payment.amount.amountCents ? { status: "refunded" } : {}),
        updatedAt: timestamp,
      }, { merge: true });
      if (nextRefunded >= payment.amount.amountCents) {
        transaction.set(orderRef, { ...order, status: "refunded", updatedAt: timestamp } satisfies Order);
      }
      return complete;
    }

    if (input.providerStatus === "failed" || input.providerStatus === "canceled") {
      const failed: ExecutableRefundCase = {
        ...refundCase,
        status: "rejected",
        providerAction: "executed",
        executionState: "failed",
        providerRefundId: input.providerRefundId,
        providerStatus: input.providerStatus,
        ...(input.failureCode ? { providerFailureCode: input.failureCode.slice(0, 160) } : {}),
        updatedAt: timestamp,
      };
      transaction.set(refundRef, failed);
      transaction.set(controlRef, {
        ...control,
        inFlightCents: Math.max(0, control.inFlightCents - amount),
        updatedAt: timestamp,
      } satisfies RefundControlRecord);
      return failed;
    }

    const providerCreated: ExecutableRefundCase = {
      ...refundCase,
      status: "approved",
      providerAction: "executed",
      executionState: "provider_created",
      providerRefundId: input.providerRefundId,
      providerStatus: input.providerStatus,
      updatedAt: timestamp,
    };
    transaction.set(refundRef, providerCreated);
    return providerCreated;
  });
}

export async function markStripeRefundStartRejected(input: {
  refundCaseId: string;
  failureCode: string;
}) {
  validateRefundCaseId(input.refundCaseId);
  const db = getAdminFirestore();
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const timestamp = now();
  return db.runTransaction(async (transaction) => {
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
    const refundCase = refundSnapshot.data() as ExecutableRefundCase;
    const controlRef = db.collection(REFUND_CONTROLS_COLLECTION).doc(refundCase.orderId);
    const controlSnapshot = await transaction.get(controlRef);
    if (!controlSnapshot.exists) throw new Error("REFUND_STATE_MISSING");
    const control = controlSnapshot.data() as RefundControlRecord;
    if (refundCase.executionState !== "locked") return refundCase;

    const failed: ExecutableRefundCase = {
      ...refundCase,
      status: "rejected",
      providerAction: "not_executed",
      executionState: "failed",
      providerFailureCode: input.failureCode.slice(0, 160),
      updatedAt: timestamp,
    };
    transaction.set(refundRef, failed);
    transaction.set(controlRef, {
      ...control,
      inFlightCents: Math.max(0, control.inFlightCents - refundCase.amount.amountCents),
      updatedAt: timestamp,
    } satisfies RefundControlRecord);
    return failed;
  });
}

export async function markStripeRefundAmbiguous(input: {
  refundCaseId: string;
  failureCode: string;
}) {
  validateRefundCaseId(input.refundCaseId);
  const db = getAdminFirestore();
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const snapshot = await refundRef.get();
  if (!snapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
  const refundCase = snapshot.data() as ExecutableRefundCase;
  if (refundCase.executionState !== "locked") return refundCase;
  const review: ExecutableRefundCase = {
    ...refundCase,
    status: "approved",
    providerAction: "not_executed",
    executionState: "manual_review",
    providerFailureCode: input.failureCode.slice(0, 160),
    updatedAt: now(),
  };
  await refundRef.set(review);
  return review;
}

export async function applyStripeRefundWebhook(input: {
  eventId: string;
  eventType: string;
  refund: StripeRefundEventData;
}) {
  const refundCaseId = input.refund.metadata?.refund_case_id;
  const orderId = input.refund.metadata?.order_id;
  const providerStatus = normalizeProviderStatus(input.refund.status);
  const db = getAdminFirestore();
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(input.eventId);
  const timestamp = now();

  return db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return { duplicate: true, outcome: "duplicate" };
    if (!refundCaseId || !orderId || !providerStatus || !REFUND_CASE_ID_PATTERN.test(refundCaseId) || !PROVIDER_REFUND_ID_PATTERN.test(input.refund.id)) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_refund_unmatched",
        processedAt: timestamp,
      });
      return { duplicate: false, outcome: "ignored_refund_unmatched" };
    }

    const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(refundCaseId);
    const refundSnapshot = await transaction.get(refundRef);
    if (!refundSnapshot.exists) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_refund_case_missing",
        orderId,
        processedAt: timestamp,
      });
      return { duplicate: false, outcome: "ignored_refund_case_missing" };
    }

    const refundCase = refundSnapshot.data() as ExecutableRefundCase;
    if (refundCase.orderId !== orderId || (refundCase.providerRefundId && refundCase.providerRefundId !== input.refund.id)) {
      transaction.set(eventRef, {
        id: input.eventId,
        provider: "stripe",
        type: input.eventType,
        outcome: "ignored_refund_mismatch",
        orderId,
        processedAt: timestamp,
      });
      return { duplicate: false, outcome: "ignored_refund_mismatch" };
    }

    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(orderId));
    const controlRef = db.collection(REFUND_CONTROLS_COLLECTION).doc(orderId);
    const [orderSnapshot, paymentSnapshot, controlSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
      transaction.get(controlRef),
    ]);
    if (!orderSnapshot.exists || !paymentSnapshot.exists || !controlSnapshot.exists) throw new Error("REFUND_STATE_MISSING");
    const order = orderSnapshot.data() as Order;
    const payment = paymentSnapshot.data() as PaymentLifecycleRecord;
    const control = controlSnapshot.data() as RefundControlRecord;
    const amount = refundCase.amount.amountCents;

    if (providerStatus === "succeeded" && refundCase.executionState !== "complete") {
      const nextRefunded = control.refundedCents + amount;
      transaction.set(refundRef, {
        ...refundCase,
        status: "processed",
        providerAction: "executed",
        executionState: "complete",
        providerRefundId: input.refund.id,
        providerStatus,
        executedAt: timestamp,
        updatedAt: timestamp,
      } satisfies ExecutableRefundCase);
      transaction.set(controlRef, {
        ...control,
        refundedCents: nextRefunded,
        inFlightCents: Math.max(0, control.inFlightCents - amount),
        updatedAt: timestamp,
      } satisfies RefundControlRecord);
      transaction.set(paymentRef, {
        refundedAmount: { amountCents: nextRefunded, currency: "EUR" },
        ...(nextRefunded >= payment.amount.amountCents ? { status: "refunded" } : {}),
        updatedAt: timestamp,
      }, { merge: true });
      if (nextRefunded >= payment.amount.amountCents) {
        transaction.set(orderRef, { ...order, status: "refunded", updatedAt: timestamp } satisfies Order);
      }
    } else if ((providerStatus === "failed" || providerStatus === "canceled") && refundCase.executionState !== "failed") {
      transaction.set(refundRef, {
        ...refundCase,
        status: "rejected",
        providerAction: "executed",
        executionState: "failed",
        providerRefundId: input.refund.id,
        providerStatus,
        ...(input.refund.failure_reason ? { providerFailureCode: input.refund.failure_reason.slice(0, 160) } : {}),
        updatedAt: timestamp,
      } satisfies ExecutableRefundCase);
      transaction.set(controlRef, {
        ...control,
        inFlightCents: Math.max(0, control.inFlightCents - amount),
        updatedAt: timestamp,
      } satisfies RefundControlRecord);
    } else if (refundCase.executionState !== "complete") {
      transaction.set(refundRef, {
        ...refundCase,
        status: "approved",
        providerAction: "executed",
        executionState: "provider_created",
        providerRefundId: input.refund.id,
        providerStatus,
        updatedAt: timestamp,
      } satisfies ExecutableRefundCase);
    }

    transaction.set(eventRef, {
      id: input.eventId,
      provider: "stripe",
      type: input.eventType,
      outcome: `refund_${providerStatus}`,
      orderId,
      providerRefundId: input.refund.id,
      processedAt: timestamp,
    });
    return { duplicate: false, outcome: `refund_${providerStatus}` };
  });
}
