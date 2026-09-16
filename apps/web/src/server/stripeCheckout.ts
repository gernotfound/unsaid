import type { Order } from "@unsaid/domain";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const DEFAULT_STRIPE_API_VERSION = "2026-08-26.dahlia";

export interface StripeCheckoutSession {
  id: string;
  url: string;
  expiresAt: string;
}

export class StripeApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "StripeApiError";
  }
}

function secretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new StripeApiError("STRIPE_NOT_CONFIGURED", 503);
  return value;
}

function headers(idempotencyKey?: string) {
  return {
    authorization: `Bearer ${secretKey()}`,
    "content-type": "application/x-www-form-urlencoded",
    "stripe-version": process.env.STRIPE_API_VERSION?.trim() || DEFAULT_STRIPE_API_VERSION,
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  };
}

async function stripeRequest(path: string, body: URLSearchParams, idempotencyKey?: string) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: headers(idempotencyKey),
    body,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = payload?.error;
    const code = error && typeof error === "object" && typeof (error as Record<string, unknown>).code === "string"
      ? String((error as Record<string, unknown>).code)
      : "STRIPE_API_ERROR";
    throw new StripeApiError(code, response.status);
  }
  if (!payload) throw new StripeApiError("STRIPE_EMPTY_RESPONSE", 502);
  return payload;
}

function checkoutUrls(siteUrl: string, orderId: string) {
  const success = new URL("/checkout", siteUrl);
  success.searchParams.set("payment", "success");
  success.searchParams.set("order", orderId);
  const cancel = new URL("/checkout", siteUrl);
  cancel.searchParams.set("payment", "cancelled");
  cancel.searchParams.set("order", orderId);
  return { success: success.toString(), cancel: cancel.toString() };
}

function appendLine(
  body: URLSearchParams,
  index: number,
  input: { name: string; unitAmount: number; quantity: number; sku?: string },
) {
  body.set(`line_items[${index}][price_data][currency]`, "eur");
  body.set(`line_items[${index}][price_data][unit_amount]`, String(input.unitAmount));
  body.set(`line_items[${index}][price_data][product_data][name]`, input.name.slice(0, 120));
  if (input.sku) body.set(`line_items[${index}][price_data][product_data][metadata][sku]`, input.sku);
  body.set(`line_items[${index}][quantity]`, String(input.quantity));
}

export async function createStripeCheckoutSession(input: {
  order: Order;
  siteUrl: string;
  providerExpiresAt: string;
}): Promise<StripeCheckoutSession> {
  const { order } = input;
  if (order.status !== "pending_payment") throw new StripeApiError("ORDER_NOT_PAYABLE", 409);
  if (order.totals.total.currency !== "EUR" || order.totals.total.amountCents < 1) {
    throw new StripeApiError("ORDER_TOTAL_INVALID", 409);
  }

  const expiresEpoch = Math.floor(new Date(input.providerExpiresAt).getTime() / 1000);
  const nowEpoch = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expiresEpoch) || expiresEpoch < nowEpoch + 29 * 60 || expiresEpoch > nowEpoch + 24 * 60 * 60) {
    throw new StripeApiError("STRIPE_EXPIRY_INVALID", 500);
  }

  const urls = checkoutUrls(input.siteUrl, order.id);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("payment_method_types[0]", "card");
  body.set("client_reference_id", order.id);
  body.set("customer_email", order.email);
  body.set("success_url", urls.success);
  body.set("cancel_url", urls.cancel);
  body.set("expires_at", String(expiresEpoch));
  body.set("metadata[order_id]", order.id);
  body.set("metadata[customer_id]", order.customerId);
  body.set("payment_intent_data[metadata][order_id]", order.id);

  let index = 0;
  for (const line of order.lines) {
    appendLine(body, index, {
      name: `${line.title} / ${line.size}`,
      unitAmount: line.unitPrice.amountCents,
      quantity: line.quantity,
      sku: line.sku,
    });
    index += 1;
  }

  if (order.totals.shipping.amountCents > 0) {
    appendLine(body, index, {
      name: order.shippingMethod?.label || "Spedizione standard Italia",
      unitAmount: order.totals.shipping.amountCents,
      quantity: 1,
    });
  }

  const payload = await stripeRequest(
    "/checkout/sessions",
    body,
    `checkout-${order.id}`,
  );
  const id = typeof payload.id === "string" ? payload.id : "";
  const url = typeof payload.url === "string" ? payload.url : "";
  const expiresAt = typeof payload.expires_at === "number"
    ? new Date(payload.expires_at * 1000).toISOString()
    : input.providerExpiresAt;
  if (!id || !url) throw new StripeApiError("STRIPE_SESSION_INVALID", 502);

  return { id, url, expiresAt };
}

export async function expireStripeCheckoutSession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new StripeApiError("STRIPE_SESSION_ID_INVALID", 400);
  const payload = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, new URLSearchParams());
  return {
    id: typeof payload.id === "string" ? payload.id : sessionId,
    status: typeof payload.status === "string" ? payload.status : "unknown",
  };
}
