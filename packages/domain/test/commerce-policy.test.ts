import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCE_POLICY,
  availableInventory,
  isAllowedShippingCountry,
} from "../src/index";

test("commerce requires an account and is Italy-only", () => {
  assert.equal(COMMERCE_POLICY.requiresAccount, true);
  assert.equal(COMMERCE_POLICY.market, "IT");
  assert.equal(COMMERCE_POLICY.currency, "EUR");
  assert.equal(COMMERCE_POLICY.catalogMode, "continuous");
  assert.deepEqual(COMMERCE_POLICY.allowedShippingCountries, ["IT"]);
});

test("shipping country guard rejects non-Italian addresses", () => {
  assert.equal(isAllowedShippingCountry("IT"), true);
  assert.equal(isAllowedShippingCountry("FR"), false);
  assert.equal(isAllowedShippingCountry("DE"), false);
});

test("available inventory never becomes negative", () => {
  assert.equal(availableInventory({ onHand: 8, reserved: 3 }), 5);
  assert.equal(availableInventory({ onHand: 2, reserved: 5 }), 0);
});
