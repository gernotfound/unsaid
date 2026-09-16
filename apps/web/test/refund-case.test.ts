import assert from "node:assert/strict";
import test from "node:test";
import { validateRefundCaseInput } from "../src/lib/refund";

test("refund case accepts a bounded positive amount and trims the reason", () => {
  assert.deepEqual(
    validateRefundCaseInput({ amountCents: 1200, maxAmountCents: 3900, reason: "  taglia errata  " }),
    { valid: true, reason: "taglia errata" },
  );
});

test("refund case rejects zero, negative and excessive amounts", () => {
  assert.deepEqual(
    validateRefundCaseInput({ amountCents: 0, maxAmountCents: 3900, reason: "reso" }),
    { valid: false, error: "INVALID_REFUND_AMOUNT" },
  );
  assert.deepEqual(
    validateRefundCaseInput({ amountCents: 4000, maxAmountCents: 3900, reason: "reso" }),
    { valid: false, error: "REFUND_AMOUNT_EXCEEDS_PAYMENT" },
  );
});

test("refund case requires a meaningful bounded reason", () => {
  assert.deepEqual(
    validateRefundCaseInput({ amountCents: 1000, maxAmountCents: 3900, reason: "x" }),
    { valid: false, error: "INVALID_REFUND_REASON" },
  );
});
