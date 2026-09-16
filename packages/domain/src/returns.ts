import type { Money, Order, OrderLine } from "./commerce";

export const RETURN_REASON_CODES = [
  "changed_mind",
  "size_issue",
  "damaged",
  "wrong_item",
  "other",
] as const;

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];
export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "in_transit"
  | "received"
  | "inspected"
  | "closed";

export interface ReturnRequestLineInput {
  variantId: string;
  quantity: number;
}

export interface ReturnInspectionLineInput {
  variantId: string;
  receivedQuantity: number;
  restockQuantity: number;
}

export interface ReturnLineSnapshot extends Pick<
  OrderLine,
  "variantId" | "sku" | "catalogId" | "title" | "size" | "garmentColor" | "unitPrice"
> {
  quantity: number;
  receivedQuantity?: number;
  restockedQuantity?: number;
}

export interface ReturnInboundShipment {
  provider?: string;
  trackingCode?: string;
  trackingUrl?: string;
}

export interface ReturnCase {
  id: string;
  orderId: string;
  customerId: string;
  email: string;
  status: ReturnStatus;
  reasonCode: ReturnReasonCode;
  note?: string;
  lines: readonly ReturnLineSnapshot[];
  inboundShipment?: ReturnInboundShipment;
  refundCaseId?: string;
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  receivedAt?: string;
  inspectedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function returnGoodsValue(lines: readonly ReturnLineSnapshot[]): Money {
  return {
    currency: "EUR",
    amountCents: lines.reduce((sum, line) => sum + line.unitPrice.amountCents * (line.receivedQuantity ?? line.quantity), 0),
  };
}

export function buildReturnLines(order: Order, requested: readonly ReturnRequestLineInput[]): ReturnLineSnapshot[] {
  if (order.status !== "delivered") throw new Error("ORDER_NOT_RETURN_ELIGIBLE");
  if (!requested.length) throw new Error("RETURN_LINES_REQUIRED");

  const orderLines = new Map(order.lines.map((line) => [line.variantId, line]));
  const seen = new Set<string>();
  const lines: ReturnLineSnapshot[] = [];

  for (const input of requested) {
    if (!input.variantId || seen.has(input.variantId)) throw new Error("INVALID_RETURN_LINES");
    seen.add(input.variantId);
    const orderLine = orderLines.get(input.variantId);
    if (!orderLine) throw new Error("RETURN_LINE_NOT_IN_ORDER");
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > orderLine.quantity) {
      throw new Error("INVALID_RETURN_QUANTITY");
    }
    lines.push({
      variantId: orderLine.variantId,
      sku: orderLine.sku,
      catalogId: orderLine.catalogId,
      title: orderLine.title,
      size: orderLine.size,
      garmentColor: orderLine.garmentColor,
      quantity: input.quantity,
      unitPrice: orderLine.unitPrice,
    });
  }

  return lines;
}

export function applyReturnInspection(
  returnCase: ReturnCase,
  inspected: readonly ReturnInspectionLineInput[],
): ReturnLineSnapshot[] {
  if (returnCase.status !== "received") throw new Error("RETURN_NOT_READY_FOR_INSPECTION");
  if (inspected.length !== returnCase.lines.length) throw new Error("RETURN_INSPECTION_LINES_MISMATCH");

  const byVariant = new Map(inspected.map((line) => [line.variantId, line]));
  return returnCase.lines.map((line) => {
    const result = byVariant.get(line.variantId);
    if (!result) throw new Error("RETURN_INSPECTION_LINES_MISMATCH");
    if (!Number.isInteger(result.receivedQuantity) || result.receivedQuantity < 0 || result.receivedQuantity > line.quantity) {
      throw new Error("INVALID_RETURN_RECEIVED_QUANTITY");
    }
    if (!Number.isInteger(result.restockQuantity) || result.restockQuantity < 0 || result.restockQuantity > result.receivedQuantity) {
      throw new Error("INVALID_RETURN_RESTOCK_QUANTITY");
    }
    return {
      ...line,
      receivedQuantity: result.receivedQuantity,
      restockedQuantity: result.restockQuantity,
    };
  });
}
