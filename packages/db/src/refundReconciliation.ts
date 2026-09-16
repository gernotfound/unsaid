import type { Order } from "@unsaid/domain";
import { getAdminFirestore } from "./firebase";
import { PAYMENTS_COLLECTION, type PaymentLifecycleRecord } from "./payments";
import type { ExecutableRefundCase, RefundControlRecord } from "./refunds";

const ORDERS_COLLECTION = "orders";
const REFUND_CASES_COLLECTION = "refundCases";
const REFUND_CONTROLS_COLLECTION = "refundControls";
const REFUND_CASE_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}__[A-Za-z0-9_-]{8,80}$/;
const PROVIDER_PAYMENT_ID_PATTERN = /^pi_[A-Za-z0-9_]+$/;
const PROVIDER_REFUND_ID_PATTERN = /^re_[A-Za-z0-9_]+$/;

function paymentId(orderId: string) {
  return `stripe__${orderId}`;
}

export interface StripeRefundReconciliationInput {
  refundCase: ExecutableRefundCase;
  order: Order;
  paymentIntentId: string;
  amountCents: number;
  providerRefundId: string | null;
}

export async function getStripeRefundReconciliationInput(
  refundCaseId: string,
): Promise<StripeRefundReconciliationInput> {
  if (!REFUND_CASE_ID_PATTERN.test(refundCaseId)) throw new Error("INVALID_REFUND_CASE_ID");
  const db = getAdminFirestore();
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(refundCaseId);
  const refundSnapshot = await refundRef.get();
  if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
  const refundCase = refundSnapshot.data() as ExecutableRefundCase;

  if (refundCase.executionState !== "manual_review" && refundCase.executionState !== "provider_created") {
    throw new Error("REFUND_NOT_RECONCILABLE");
  }

  const orderRef = db.collection(ORDERS_COLLECTION).doc(refundCase.orderId);
  const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId(refundCase.orderId));
  const controlRef = db.collection(REFUND_CONTROLS_COLLECTION).doc(refundCase.orderId);
  const [orderSnapshot, paymentSnapshot, controlSnapshot] = await Promise.all([
    orderRef.get(),
    paymentRef.get(),
    controlRef.get(),
  ]);
  if (!orderSnapshot.exists || !paymentSnapshot.exists || !controlSnapshot.exists) {
    throw new Error("REFUND_STATE_MISSING");
  }

  const order = orderSnapshot.data() as Order;
  const payment = paymentSnapshot.data() as PaymentLifecycleRecord;
  const control = controlSnapshot.data() as RefundControlRecord;
  if (!payment.providerPaymentId || !PROVIDER_PAYMENT_ID_PATTERN.test(payment.providerPaymentId)) {
    throw new Error("PAYMENT_PROVIDER_ID_MISSING");
  }
  if (control.paymentAmountCents !== payment.amount.amountCents) {
    throw new Error("REFUND_CONTROL_AMOUNT_MISMATCH");
  }
  if (control.inFlightCents < refundCase.amount.amountCents) {
    throw new Error("REFUND_CONTROL_INFLIGHT_MISMATCH");
  }
  if (refundCase.providerRefundId && !PROVIDER_REFUND_ID_PATTERN.test(refundCase.providerRefundId)) {
    throw new Error("INVALID_PROVIDER_REFUND_ID");
  }

  return {
    refundCase,
    order,
    paymentIntentId: payment.providerPaymentId,
    amountCents: refundCase.amount.amountCents,
    providerRefundId: refundCase.providerRefundId ?? null,
  };
}
