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

test("withdrawal acknowledgement contains statement and server timestamp", () => {
  const message = renderTransactionalEmail({
    kind: "withdrawal_acknowledgement",
    orderId: "ORD-abcdefghijklmnop",
    toEmail: "customer@example.com",
    withdrawalNoticeId: "withdrawal__ORD-abcdefghijklmnop__abcdefgh",
    consumerName: "Mario Rossi",
    statement: "Mario Rossi comunica la decisione di recedere dal contratto relativo all'ordine ORD-abcdefghijklmnop.",
    submittedAt: "2026-09-18T05:20:00.000Z",
  });
  assert.equal(message.to, "customer@example.com");
  assert.match(message.subject, /ricezione recesso/);
  assert.match(message.text, /withdrawal__ORD-abcdefghijklmnop__abcdefgh/);
  assert.match(message.text, /Mario Rossi comunica/);
  assert.match(message.text, /2026-09-18T05:20:00.000Z/);
});


test("shipment email requires shipment data", () => {
  assert.throws(() => renderTransactionalEmail({
    kind: "shipment_confirmation",
    orderId: "ORD-abcdefghijklmnop",
    toEmail: "customer@example.com",
    totalCents: 4900,
    currency: "EUR",
  } as never), /SHIPMENT_EMAIL_REQUIRES_SHIPMENT/);
});
