const STRIPE_API_BASE = "https://api.stripe.com/v1";
const DEFAULT_STRIPE_API_VERSION = "2026-08-26.dahlia";

export type StripeRefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

export interface StripeRefundResult {
  id: string;
  status: StripeRefundStatus;
  amount: number;
  paymentIntentId: string | null;
  failureReason: string | null;
}

export class StripeRefundApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "StripeRefundApiError";
  }
}

function secretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new StripeRefundApiError("STRIPE_NOT_CONFIGURED", 503);
  return value;
}

function refundStatus(value: unknown): StripeRefundStatus {
  if (value === "pending" || value === "requires_action" || value === "succeeded" || value === "failed" || value === "canceled") {
    return value;
  }
  throw new StripeRefundApiError("STRIPE_REFUND_STATUS_INVALID", 502);
}

function sanitizeMetadata(value: string) {
  return value.replace(/[\r\n]/g, " ").slice(0, 450);
}

export async function createStripeRefund(input: {
  refundCaseId: string;
  orderId: string;
  paymentIntentId: string;
  amountCents: number;
  internalReason: string;
}): Promise<StripeRefundResult> {
  if (!/^pi_[A-Za-z0-9_]+$/.test(input.paymentIntentId)) {
    throw new StripeRefundApiError("STRIPE_PAYMENT_INTENT_INVALID", 400);
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    throw new StripeRefundApiError("STRIPE_REFUND_AMOUNT_INVALID", 400);
  }

  const body = new URLSearchParams();
  body.set("payment_intent", input.paymentIntentId);
  body.set("amount", String(input.amountCents));
  body.set("metadata[refund_case_id]", input.refundCaseId);
  body.set("metadata[order_id]", input.orderId);
  body.set("metadata[internal_reason]", sanitizeMetadata(input.internalReason));

  let response: Response;
  try {
    response = await fetch(`${STRIPE_API_BASE}/refunds`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey()}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": process.env.STRIPE_API_VERSION?.trim() || DEFAULT_STRIPE_API_VERSION,
        "idempotency-key": `refund-${input.refundCaseId}`,
      },
      body,
      cache: "no-store",
    });
  } catch {
    throw new StripeRefundApiError("STRIPE_REFUND_NETWORK_AMBIGUOUS", 0);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = payload?.error;
    const code = error && typeof error === "object" && typeof (error as Record<string, unknown>).code === "string"
      ? String((error as Record<string, unknown>).code)
      : "STRIPE_REFUND_API_ERROR";
    throw new StripeRefundApiError(code, response.status);
  }
  if (!payload) throw new StripeRefundApiError("STRIPE_REFUND_EMPTY_RESPONSE", 502);

  const id = typeof payload.id === "string" ? payload.id : "";
  const amount = typeof payload.amount === "number" ? payload.amount : NaN;
  if (!/^re_[A-Za-z0-9_]+$/.test(id) || !Number.isInteger(amount) || amount !== input.amountCents) {
    throw new StripeRefundApiError("STRIPE_REFUND_RESPONSE_INVALID", 502);
  }

  return {
    id,
    status: refundStatus(payload.status),
    amount,
    paymentIntentId: typeof payload.payment_intent === "string" ? payload.payment_intent : null,
    failureReason: typeof payload.failure_reason === "string" ? payload.failure_reason : null,
  };
}
