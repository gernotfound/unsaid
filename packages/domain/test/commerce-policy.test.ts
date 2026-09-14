import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCE_POLICY,
  availableInventory,
  checkoutEligibility,
  isAllowedShippingCountry,
} from "../src/index";

test("commerce requires an account, verified email and is Italy-only", () => {
  assert.equal(COMMERCE_POLICY.requiresAccount, true);
  assert.equal(COMMERCE_POLICY.requiresVerifiedEmail, true);
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

test("checkout policy fails closed", () => {
  assert.deepEqual(
    checkoutEligibility({ commerceEnabled: false, authenticated: true, emailVerified: true, shippingCountry: "IT" }),
    { allowed: false, reason: "commerce_disabled" },
  );
  assert.deepEqual(
    checkoutEligibility({ commerceEnabled: true, authenticated: false, emailVerified: false, shippingCountry: "IT" }),
    { allowed: false, reason: "account_required" },
  );
  assert.deepEqual(
    checkoutEligibility({ commerceEnabled: true, authenticated: true, emailVerified: false, shippingCountry: "IT" }),
    { allowed: false, reason: "email_unverified" },
  );
  assert.deepEqual(
    checkoutEligibility({ commerceEnabled: true, authenticated: true, emailVerified: true, shippingCountry: "FR" }),
    { allowed: false, reason: "country_unsupported" },
  );
  assert.deepEqual(
    checkoutEligibility({ commerceEnabled: true, authenticated: true, emailVerified: true, shippingCountry: "IT" }),
    { allowed: true },
  );
});
