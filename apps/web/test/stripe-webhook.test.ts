import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  StripeWebhookError,
  verifyStripeWebhookSignature,
} from "../src/server/stripeWebhook";

const secret = "whsec_test_secret";
const timestamp = 1_800_000_000;
const body = JSON.stringify({
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1" } },
});

function signature(payload = body, time = timestamp) {
  const digest = createHmac("sha256", secret)
    .update(`${time}.${payload}`, "utf8")
    .digest("hex");
  return `t=${time},v1=${digest}`;
}

test("valid Stripe webhook signature is accepted", () => {
  const event = verifyStripeWebhookSignature(body, signature(), secret, {
    nowMs: timestamp * 1000,
  });
  assert.equal(event.id, "evt_test_1");
  assert.equal(event.type, "checkout.session.completed");
});

test("tampered Stripe webhook body is rejected", () => {
  assert.throws(
    () => verifyStripeWebhookSignature(`${body} `, signature(), secret, { nowMs: timestamp * 1000 }),
    (error) => error instanceof StripeWebhookError && error.code === "STRIPE_SIGNATURE_INVALID",
  );
});

test("stale Stripe webhook signature is rejected", () => {
  assert.throws(
    () => verifyStripeWebhookSignature(body, signature(), secret, { nowMs: (timestamp + 301) * 1000 }),
    (error) => error instanceof StripeWebhookError && error.code === "STRIPE_SIGNATURE_EXPIRED",
  );
});
