import assert from "node:assert/strict";
import test from "node:test";
import { renderTransactionalEmail } from "../src/email";

test("order confirmation email uses authoritative order values", () => {
  const message = renderTransactionalEmail({
    kind: "order_confirmation",
    orderId: "ORD-abcdefghijklmnop",
    toEmail: "customer@example.com",
    totalCents: 4900,
    currency: "EUR",
  });
  assert.equal(message.to, "customer@example.com");
  assert.match(message.subject, /ORD-abcdefghijklmnop/);
  assert.match(message.text, /49,00/);
});

test("shipment email contains provider and tracking", () => {
  const message = renderTransactionalEmail({
    kind: "shipment_confirmation",
    orderId: "ORD-abcdefghijklmnop",
    toEmail: "customer@example.com",
    totalCents: 4900,
    currency: "EUR",
    shipment: {
      provider: "BRT",
      trackingCode: "ABC123",
      trackingUrl: "https://tracking.example/ABC123",
    },
  });
  assert.match(message.text, /BRT/);
  assert.match(message.text, /ABC123/);
  assert.match(message.text, /https:\/\/tracking\.example\/ABC123/);
});

test("shipment email requires shipment data", () => {
  assert.throws(() => renderTransactionalEmail({
    kind: "shipment_confirmation",
    orderId: "ORD-abcdefghijklmnop",
    toEmail: "customer@example.com",
    totalCents: 4900,
    currency: "EUR",
  }), /SHIPMENT_EMAIL_REQUIRES_SHIPMENT/);
});
