import test from "node:test";
import assert from "node:assert/strict";
import { createStripeRefund, StripeRefundApiError } from "../src/server/stripeRefund";

test("Stripe refund uses authoritative amount, PaymentIntent and deterministic idempotency", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  let captured: { url: string; init: RequestInit | undefined } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({
      id: "re_test_123",
      status: "succeeded",
      amount: 2500,
      payment_intent: "pi_test_123",
      failure_reason: null,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await createStripeRefund({
      refundCaseId: "ORD-abcdefghijklmnop__refund_12345678",
      orderId: "ORD-abcdefghijklmnop",
      paymentIntentId: "pi_test_123",
      amountCents: 2500,
      internalReason: "Customer requested return",
    });
    assert.equal(result.status, "succeeded");
    assert.equal(result.amount, 2500);
    assert.ok(captured);
    const request = captured as { url: string; init: RequestInit | undefined };
    assert.equal(request.url, "https://api.stripe.com/v1/refunds");
    const headers = request.init?.headers as Record<string, string>;
    assert.equal(headers["idempotency-key"], "refund-ORD-abcdefghijklmnop__refund_12345678");
    const body = request.init?.body as URLSearchParams;
    assert.equal(body.get("payment_intent"), "pi_test_123");
    assert.equal(body.get("amount"), "2500");
    assert.equal(body.get("metadata[order_id]"), "ORD-abcdefghijklmnop");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  }
});

test("Stripe refund rejects an invalid PaymentIntent before network access", async () => {
  await assert.rejects(
    createStripeRefund({
      refundCaseId: "ORD-abcdefghijklmnop__refund_12345678",
      orderId: "ORD-abcdefghijklmnop",
      paymentIntentId: "bad",
      amountCents: 100,
      internalReason: "test",
    }),
    (error: unknown) => error instanceof StripeRefundApiError && error.code === "STRIPE_PAYMENT_INTENT_INVALID",
  );
});

test("Stripe refund converts transport uncertainty into an ambiguous provider error", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  globalThis.fetch = (async () => { throw new Error("socket closed"); }) as typeof fetch;
  try {
    await assert.rejects(
      createStripeRefund({
        refundCaseId: "ORD-abcdefghijklmnop__refund_12345678",
        orderId: "ORD-abcdefghijklmnop",
        paymentIntentId: "pi_test_123",
        amountCents: 100,
        internalReason: "test",
      }),
      (error: unknown) => error instanceof StripeRefundApiError
        && error.code === "STRIPE_REFUND_NETWORK_AMBIGUOUS"
        && error.status === 0,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  }
});
