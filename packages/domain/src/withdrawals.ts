import type { Order, OrderLine } from "./commerce";

export const WITHDRAWAL_SCOPES = ["whole_order", "partial_order"] as const;
export type WithdrawalScope = (typeof WITHDRAWAL_SCOPES)[number];

export interface WithdrawalLineInput {
  variantId: string;
  quantity: number;
}

export interface WithdrawalLineSnapshot extends Pick<
  OrderLine,
  "variantId" | "sku" | "catalogId" | "title" | "size" | "garmentColor" | "unitPrice"
> {
  quantity: number;
}

export interface WithdrawalAcknowledgementTarget {
  channel: "email";
  destination: string;
}

export interface WithdrawalConfirmationEvidence {
  action: "confirm_withdrawal";
  confirmedAt: string;
}

export interface WithdrawalNotice {
  id: string;
  orderId: string;
  customerId: string;
  orderEmail: string;
  consumerName: string;
  scope: WithdrawalScope;
  lines: readonly WithdrawalLineSnapshot[];
  statement: string;
  statementVersion: 1;
  submissionMethod: "online_withdrawal_function";
  confirmation: WithdrawalConfirmationEvidence;
  orderStatusAtSubmission: Order["status"];
  acknowledgementTarget: WithdrawalAcknowledgementTarget;
  acknowledgementNotificationId: string;
  returnCaseIds: readonly string[];
  refundCaseIds: readonly string[];
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeWithdrawalConsumerName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error("INVALID_WITHDRAWAL_CONSUMER_NAME");
  }
  return normalized;
}

export function buildWithdrawalLines(
  order: Order,
  scope: WithdrawalScope,
  requested: readonly WithdrawalLineInput[] = [],
): WithdrawalLineSnapshot[] {
  if (scope === "whole_order") {
    if (requested.length) throw new Error("WHOLE_ORDER_WITHDRAWAL_LINES_NOT_ALLOWED");
    if (!order.lines.length) throw new Error("WITHDRAWAL_ORDER_LINES_MISSING");
    return order.lines.map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      catalogId: line.catalogId,
      title: line.title,
      size: line.size,
      garmentColor: line.garmentColor,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));
  }

  if (scope !== "partial_order") throw new Error("INVALID_WITHDRAWAL_SCOPE");
  if (!requested.length || requested.length > 20) throw new Error("WITHDRAWAL_LINES_REQUIRED");

  const orderLines = new Map(order.lines.map((line) => [line.variantId, line]));
  const quantities = new Map<string, number>();

  for (const input of requested) {
    if (!input.variantId || quantities.has(input.variantId)) throw new Error("INVALID_WITHDRAWAL_LINES");
    const orderLine = orderLines.get(input.variantId);
    if (!orderLine) throw new Error("WITHDRAWAL_LINE_NOT_IN_ORDER");
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > orderLine.quantity) {
      throw new Error("INVALID_WITHDRAWAL_QUANTITY");
    }
    quantities.set(input.variantId, input.quantity);
  }

  return order.lines
    .filter((line) => quantities.has(line.variantId))
    .map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      catalogId: line.catalogId,
      title: line.title,
      size: line.size,
      garmentColor: line.garmentColor,
      quantity: quantities.get(line.variantId)!,
      unitPrice: line.unitPrice,
    }));
}

export function buildWithdrawalStatement(input: {
  orderId: string;
  consumerName: string;
  scope: WithdrawalScope;
  lines: readonly WithdrawalLineSnapshot[];
}) {
  const name = normalizeWithdrawalConsumerName(input.consumerName);
  if (!/^ORD-[A-Za-z0-9_-]{16,80}$/.test(input.orderId)) throw new Error("INVALID_ORDER_ID");
  if (!input.lines.length) throw new Error("WITHDRAWAL_LINES_REQUIRED");

  if (input.scope === "whole_order") {
    return `${name} comunica in modo inequivocabile la decisione di recedere dal contratto relativo all'ordine ${input.orderId}.`;
  }
  if (input.scope !== "partial_order") throw new Error("INVALID_WITHDRAWAL_SCOPE");

  const goods = input.lines
    .map((line) => `${line.title} (${line.sku}) x${line.quantity}`)
    .join(", ");
  return `${name} comunica in modo inequivocabile la decisione di recedere dal contratto relativo all'ordine ${input.orderId}, limitatamente ai seguenti beni: ${goods}.`;
}

export function sameWithdrawalSelection(
  notice: Pick<WithdrawalNotice, "consumerName" | "scope" | "lines">,
  input: { consumerName: string; scope: WithdrawalScope; lines: readonly WithdrawalLineSnapshot[] },
) {
  return notice.consumerName === normalizeWithdrawalConsumerName(input.consumerName)
    && notice.scope === input.scope
    && JSON.stringify(notice.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })))
      === JSON.stringify(input.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })));
}
