export interface RefundCaseInput {
  amountCents: number;
  maxAmountCents: number;
  reason: string;
}

export type RefundCaseValidation =
  | { valid: true; reason: string }
  | { valid: false; error: "INVALID_REFUND_AMOUNT" | "REFUND_AMOUNT_EXCEEDS_PAYMENT" | "INVALID_REFUND_REASON" };

export function validateRefundCaseInput(input: RefundCaseInput): RefundCaseValidation {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    return { valid: false, error: "INVALID_REFUND_AMOUNT" };
  }
  if (!Number.isInteger(input.maxAmountCents) || input.maxAmountCents < 1 || input.amountCents > input.maxAmountCents) {
    return { valid: false, error: "REFUND_AMOUNT_EXCEEDS_PAYMENT" };
  }
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    return { valid: false, error: "INVALID_REFUND_REASON" };
  }
  return { valid: true, reason };
}
