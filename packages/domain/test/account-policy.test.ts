import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidItalianAddress,
  normalizeItalianAddress,
  validateItalianAddress,
  type CustomerAddressInput,
} from "../src/index";

const valid: CustomerAddressInput = {
  label: "Casa",
  recipientName: "Mario Rossi",
  line1: "Via Roma 10",
  city: "Napoli",
  province: "na",
  postalCode: "80100",
  country: "IT",
  phone: "+39 333 1234567",
};

test("Italian addresses are normalized before persistence", () => {
  const normalized = normalizeItalianAddress(valid);
  assert.equal(normalized.province, "NA");
  assert.equal(normalized.country, "IT");
  assert.equal(isValidItalianAddress(normalized), true);
});

test("invalid postal code and province are rejected", () => {
  const errors = validateItalianAddress({ ...valid, postalCode: "801", province: "Napoli" });
  assert.ok(errors.some((item) => item.field === "postalCode"));
  assert.ok(errors.some((item) => item.field === "province"));
});
