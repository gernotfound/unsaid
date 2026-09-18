import test from "node:test";
import assert from "node:assert/strict";
import type { Order, ReturnCase } from "../src/index";
import { applyReturnInspection, buildReturnLines, returnGoodsValue, sameReturnInspection } from "../src/index";

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
  ],
  totals: {
    subtotal: { amountCents: 10000, currency: "EUR" },
    shipping: { amountCents: 0, currency: "EUR" },
    tax: { amountCents: 1803, currency: "EUR" },
    total: { amountCents: 10000, currency: "EUR" },
  },
  status: "delivered",
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
};

test("return request snapshots only purchased quantities from delivered orders", () => {
  const lines = buildReturnLines(order, [{ variantId: "UNS-0001-WHT-M", quantity: 1 }]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 1);
  assert.equal(lines[0]?.unitPrice.amountCents, 5000);
  assert.throws(
    () => buildReturnLines(order, [{ variantId: "UNS-0001-WHT-M", quantity: 3 }]),
    /INVALID_RETURN_QUANTITY/,
  );
  assert.throws(
    () => buildReturnLines({ ...order, status: "shipped" }, [{ variantId: "UNS-0001-WHT-M", quantity: 1 }]),
    /ORDER_NOT_RETURN_ELIGIBLE/,
  );
});

test("return inspection cannot restock more units than physically received", () => {
  const returnCase: ReturnCase = {
    id: "return__ORD-abcdefghijklmnop",
    orderId: order.id,
    customerId: order.customerId,
    email: order.email,
    status: "received",
    reasonCode: "size_issue",
    lines: buildReturnLines(order, [{ variantId: "UNS-0001-WHT-M", quantity: 2 }]),
    requestedAt: "2026-09-16T00:00:00.000Z",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };

  const inspected = applyReturnInspection(returnCase, [{
    variantId: "UNS-0001-WHT-M",
    receivedQuantity: 2,
    restockQuantity: 1,
  }]);
  assert.equal(inspected[0]?.receivedQuantity, 2);
  assert.equal(inspected[0]?.restockedQuantity, 1);
  assert.equal(returnGoodsValue(inspected).amountCents, 10000);

  assert.throws(
    () => applyReturnInspection(returnCase, [{
      variantId: "UNS-0001-WHT-M",
      receivedQuantity: 1,
      restockQuantity: 2,
    }]),
    /INVALID_RETURN_RESTOCK_QUANTITY/,
  );
});

test("identical inspection retries are recognizable after inspection or close", () => {
  const inspectedCase: ReturnCase = {
    id: "return__ORD-abcdefghijklmnop",
    orderId: order.id,
    customerId: order.customerId,
    email: order.email,
    status: "inspected",
    reasonCode: "size_issue",
    lines: [{
      ...buildReturnLines(order, [{ variantId: "UNS-0001-WHT-M", quantity: 2 }])[0]!,
      receivedQuantity: 2,
      restockedQuantity: 1,
    }],
    requestedAt: "2026-09-16T00:00:00.000Z",
    inspectedAt: "2026-09-16T01:00:00.000Z",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T01:00:00.000Z",
  };
  const retry = [{ variantId: "UNS-0001-WHT-M", receivedQuantity: 2, restockQuantity: 1 }];
  assert.equal(sameReturnInspection(inspectedCase, retry), true);
  assert.equal(sameReturnInspection({ ...inspectedCase, status: "closed" }, retry), true);
  assert.equal(sameReturnInspection(inspectedCase, [{ ...retry[0]!, restockQuantity: 2 }]), false);
});
