import test from "node:test";
import assert from "node:assert/strict";
import type { Order } from "../src/index";
import {
  buildWithdrawalLines,
  buildWithdrawalStatement,
  normalizeWithdrawalConsumerName,
} from "../src/index";

const order: Order = {
  id: "ORD-abcdefghijklmnop",
  customerId: "customer-1",
  email: "customer@example.com",
  shippingAddress: {
    id: "address-1",
    label: "Casa",
    recipientName: "Test Customer",
    line1: "Via Test 1",
    city: "Milano",
    province: "MI",
    postalCode: "20100",
    country: "IT",
  },
  lines: [
    {
      variantId: "UNS-0001-WHT-M",
      sku: "UNS-0001-WHT-M",
      catalogId: "UNS-0001",
      title: "UNSAID 01",
      size: "M",
      garmentColor: "white",
      quantity: 2,
      unitPrice: { amountCents: 5000, currency: "EUR" },
    },
    {
      variantId: "UNS-0002-BLK-L",
      sku: "UNS-0002-BLK-L",
      catalogId: "UNS-0002",
      title: "UNSAID 02",
      size: "L",
      garmentColor: "black",
      quantity: 1,
      unitPrice: { amountCents: 6000, currency: "EUR" },
    },
  ],
  totals: {
    subtotal: { amountCents: 16000, currency: "EUR" },
    shipping: { amountCents: 0, currency: "EUR" },
    tax: { amountCents: 2885, currency: "EUR" },
    total: { amountCents: 16000, currency: "EUR" },
  },
  status: "processing",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

test("withdrawal snapshots a whole order without requiring delivery or a reason", () => {
  const lines = buildWithdrawalLines(order, "whole_order");
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.quantity, 2);
  assert.equal(normalizeWithdrawalConsumerName("  Mario   Rossi "), "Mario Rossi");
  const statement = buildWithdrawalStatement({
    orderId: order.id,
    consumerName: "Mario Rossi",
    scope: "whole_order",
    lines,
  });
  assert.match(statement, /ORD-abcdefghijklmnop/);
  assert.match(statement, /recedere/);
});

test("partial withdrawal selection cannot exceed the immutable order snapshot", () => {
  const lines = buildWithdrawalLines(order, "partial_order", [
    { variantId: "UNS-0001-WHT-M", quantity: 1 },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 1);
  const statement = buildWithdrawalStatement({
    orderId: order.id,
    consumerName: "Mario Rossi",
    scope: "partial_order",
    lines,
  });
  assert.match(statement, /UNSAID 01/);
  assert.match(statement, /UNS-0001-WHT-M/);

  assert.throws(
    () => buildWithdrawalLines(order, "partial_order", [
      { variantId: "UNS-0001-WHT-M", quantity: 3 },
    ]),
    /INVALID_WITHDRAWAL_QUANTITY/,
  );
});

test("whole-order withdrawal rejects contradictory line selection", () => {
  assert.throws(
    () => buildWithdrawalLines(order, "whole_order", [
      { variantId: "UNS-0001-WHT-M", quantity: 1 },
    ]),
    /WHOLE_ORDER_WITHDRAWAL_LINES_NOT_ALLOWED/,
  );
});


test("partial withdrawal selection is canonical across client line ordering", () => {
  const left = buildWithdrawalLines(order, "partial_order", [
    { variantId: "UNS-0002-BLK-L", quantity: 1 },
    { variantId: "UNS-0001-WHT-M", quantity: 1 },
  ]);
  const right = buildWithdrawalLines(order, "partial_order", [
    { variantId: "UNS-0001-WHT-M", quantity: 1 },
    { variantId: "UNS-0002-BLK-L", quantity: 1 },
  ]);
  assert.deepEqual(left, right);
  assert.deepEqual(left.map((line) => line.variantId), ["UNS-0001-WHT-M", "UNS-0002-BLK-L"]);
});
