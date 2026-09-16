import type {
  InventorySnapshot,
  Order,
  ReturnCase,
  ReturnInspectionLineInput,
  ReturnReasonCode,
  ReturnRequestLineInput,
} from "@unsaid/domain";
import {
  applyReturnInspection,
  buildReturnLines,
  RETURN_REASON_CODES,
} from "@unsaid/domain";
import { INVENTORY_COLLECTION } from "./commerce";
import { getAdminFirestore } from "./firebase";
import { SHIPMENTS_COLLECTION, type FulfillmentShipmentRecord } from "./fulfillment";

export const RETURN_CASES_COLLECTION = "returnCases";
const ORDERS_COLLECTION = "orders";
const REFUND_CASES_COLLECTION = "refundCases";
const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;
const RETURN_CASE_ID_PATTERN = /^return__ORD-[A-Za-z0-9_-]{16,80}$/;

export interface AdminReturnListItem {
  returnCase: ReturnCase;
  order: Order | null;
  refundCase: Record<string, unknown> | null;
}

function returnCaseId(orderId: string) {
  return `return__${orderId}`;
}

function shipmentId(orderId: string) {
  return `shipment__${orderId}`;
}

function validateOrderId(orderId: string) {
  if (!ORDER_ID_PATTERN.test(orderId)) throw new Error("INVALID_ORDER_ID");
}

function validateReturnCaseId(id: string) {
  if (!RETURN_CASE_ID_PATTERN.test(id)) throw new Error("INVALID_RETURN_CASE_ID");
}

function normalizeNote(value?: string) {
  const note = value?.trim().replace(/\s+/g, " ");
  if (!note) return undefined;
  if (note.length > 1000) throw new Error("INVALID_RETURN_NOTE");
  return note;
}

function normalizeProvider(value?: string) {
  const provider = value?.trim().replace(/\s+/g, " ");
  if (!provider) return undefined;
  if (provider.length > 80 || !/^[\p{L}\p{N} ._&'()/-]+$/u.test(provider)) {
    throw new Error("INVALID_RETURN_PROVIDER");
  }
  return provider;
}

function normalizeTrackingCode(value?: string) {
  const trackingCode = value?.trim();
  if (!trackingCode) return undefined;
  if (trackingCode.length > 120 || !/^[A-Za-z0-9 ._/-]+$/.test(trackingCode)) {
    throw new Error("INVALID_RETURN_TRACKING_CODE");
  }
  return trackingCode;
}

function normalizeTrackingUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.length > 500) throw new Error("INVALID_RETURN_TRACKING_URL");
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("INVALID_RETURN_TRACKING_URL");
    return url.toString();
  } catch {
    throw new Error("INVALID_RETURN_TRACKING_URL");
  }
}

function sameRequest(
  existing: ReturnCase,
  reasonCode: ReturnReasonCode,
  note: string | undefined,
  lines: ReturnCase["lines"],
) {
  return existing.reasonCode === reasonCode
    && (existing.note ?? "") === (note ?? "")
    && JSON.stringify(existing.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })))
      === JSON.stringify(lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })));
}

export async function createCustomerReturnRequest(input: {
  customerId: string;
  orderId: string;
  reasonCode: ReturnReasonCode;
  note?: string;
  lines: readonly ReturnRequestLineInput[];
}): Promise<ReturnCase> {
  validateOrderId(input.orderId);
  if (!RETURN_REASON_CODES.includes(input.reasonCode)) throw new Error("INVALID_RETURN_REASON");
  const note = normalizeNote(input.note);
  const db = getAdminFirestore();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const shipmentRef = db.collection(SHIPMENTS_COLLECTION).doc(shipmentId(input.orderId));
  const returnRef = db.collection(RETURN_CASES_COLLECTION).doc(returnCaseId(input.orderId));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, shipmentSnapshot, returnSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(shipmentRef),
      transaction.get(returnRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");
    if (!shipmentSnapshot.exists || (shipmentSnapshot.data() as FulfillmentShipmentRecord).status !== "delivered") {
      throw new Error("ORDER_NOT_RETURN_ELIGIBLE");
    }
    const lines = buildReturnLines(order, input.lines);

    if (returnSnapshot.exists) {
      const existing = returnSnapshot.data() as ReturnCase;
      if (sameRequest(existing, input.reasonCode, note, lines)) return existing;
      throw new Error("RETURN_ALREADY_EXISTS");
    }

    const returnCase: ReturnCase = {
      id: returnRef.id,
      orderId: order.id,
      customerId: order.customerId,
      email: order.email,
      status: "requested",
      reasonCode: input.reasonCode,
      ...(note ? { note } : {}),
      lines,
      requestedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(returnRef, returnCase);
    return returnCase;
  });
}

export async function listCustomerReturns(
  customerId: string,
  orders: readonly Pick<Order, "id" | "customerId">[],
): Promise<readonly ReturnCase[]> {
  const owned = orders.filter((order) => order.customerId === customerId);
  if (!owned.length) return [];
  const db = getAdminFirestore();
  const refs = owned.map((order) => db.collection(RETURN_CASES_COLLECTION).doc(returnCaseId(order.id)));
  const snapshots = await db.getAll(...refs);
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => snapshot.data() as ReturnCase)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listAdminReturnCases(limitInput = 75): Promise<readonly AdminReturnListItem[]> {
  const db = getAdminFirestore();
  const limit = Math.min(100, Math.max(1, Math.trunc(limitInput)));
  const snapshot = await db.collection(RETURN_CASES_COLLECTION).orderBy("createdAt", "desc").limit(limit).get();
  const returnCases = snapshot.docs.map((doc) => doc.data() as ReturnCase);
  if (!returnCases.length) return [];

  const orderRefs = returnCases.map((item) => db.collection(ORDERS_COLLECTION).doc(item.orderId));
  const orderSnapshots = await db.getAll(...orderRefs);
  const refundRefs = returnCases
    .filter((item) => item.refundCaseId)
    .map((item) => db.collection(REFUND_CASES_COLLECTION).doc(item.refundCaseId!));
  const refundSnapshots = refundRefs.length ? await db.getAll(...refundRefs) : [];
  const refunds = new Map(refundSnapshots.filter((entry) => entry.exists).map((entry) => [entry.id, entry.data() as Record<string, unknown>]));

  return returnCases.map((returnCase, index) => ({
    returnCase,
    order: orderSnapshots[index]?.exists ? (orderSnapshots[index]!.data() as Order) : null,
    refundCase: returnCase.refundCaseId ? refunds.get(returnCase.refundCaseId) ?? null : null,
  }));
}

export async function decideReturnCase(input: {
  returnCaseId: string;
  action: "approve" | "reject";
}): Promise<ReturnCase> {
  validateReturnCaseId(input.returnCaseId);
  const db = getAdminFirestore();
  const ref = db.collection(RETURN_CASES_COLLECTION).doc(input.returnCaseId);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const returnCase = snapshot.data() as ReturnCase;
    if (returnCase.status === (input.action === "approve" ? "approved" : "rejected")) return returnCase;
    if (returnCase.status !== "requested") throw new Error("RETURN_STATE_CONFLICT");
    const updated: ReturnCase = input.action === "approve"
      ? { ...returnCase, status: "approved", approvedAt: timestamp, updatedAt: timestamp }
      : { ...returnCase, status: "rejected", rejectedAt: timestamp, updatedAt: timestamp };
    transaction.set(ref, updated);
    return updated;
  });
}

export async function markReturnInTransit(input: {
  returnCaseId: string;
  provider?: string;
  trackingCode?: string;
  trackingUrl?: string;
}): Promise<ReturnCase> {
  validateReturnCaseId(input.returnCaseId);
  const provider = normalizeProvider(input.provider);
  const trackingCode = normalizeTrackingCode(input.trackingCode);
  const trackingUrl = normalizeTrackingUrl(input.trackingUrl);
  const db = getAdminFirestore();
  const ref = db.collection(RETURN_CASES_COLLECTION).doc(input.returnCaseId);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const returnCase = snapshot.data() as ReturnCase;
    if (returnCase.status === "in_transit") return returnCase;
    if (returnCase.status !== "approved") throw new Error("RETURN_STATE_CONFLICT");
    const updated: ReturnCase = {
      ...returnCase,
      status: "in_transit",
      inboundShipment: {
        ...(provider ? { provider } : {}),
        ...(trackingCode ? { trackingCode } : {}),
        ...(trackingUrl ? { trackingUrl } : {}),
      },
      updatedAt: timestamp,
    };
    transaction.set(ref, updated);
    return updated;
  });
}

export async function markReturnReceived(returnCaseIdInput: string): Promise<ReturnCase> {
  validateReturnCaseId(returnCaseIdInput);
  const db = getAdminFirestore();
  const ref = db.collection(RETURN_CASES_COLLECTION).doc(returnCaseIdInput);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const returnCase = snapshot.data() as ReturnCase;
    if (returnCase.status === "received") return returnCase;
    if (returnCase.status !== "approved" && returnCase.status !== "in_transit") throw new Error("RETURN_STATE_CONFLICT");
    const updated: ReturnCase = { ...returnCase, status: "received", receivedAt: timestamp, updatedAt: timestamp };
    transaction.set(ref, updated);
    return updated;
  });
}

export async function inspectReturnCase(input: {
  returnCaseId: string;
  lines: readonly ReturnInspectionLineInput[];
}): Promise<ReturnCase> {
  validateReturnCaseId(input.returnCaseId);
  const db = getAdminFirestore();
  const ref = db.collection(RETURN_CASES_COLLECTION).doc(input.returnCaseId);
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const returnCase = snapshot.data() as ReturnCase;
    const lines = applyReturnInspection(returnCase, input.lines);
    const restockLines = lines.filter((line) => (line.restockedQuantity ?? 0) > 0);
    const inventoryRefs = restockLines.map((line) => db.collection(INVENTORY_COLLECTION).doc(line.variantId));
    const inventorySnapshots = await Promise.all(inventoryRefs.map((inventoryRef) => transaction.get(inventoryRef)));

    for (const inventorySnapshot of inventorySnapshots) {
      if (!inventorySnapshot.exists) throw new Error("RETURN_INVENTORY_MISSING");
    }
    for (let index = 0; index < restockLines.length; index += 1) {
      const line = restockLines[index]!;
      const inventoryRef = inventoryRefs[index]!;
      const inventory = inventorySnapshots[index]!.data() as InventorySnapshot;
      transaction.set(inventoryRef, {
        ...inventory,
        onHand: inventory.onHand + (line.restockedQuantity ?? 0),
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
    }

    const updated: ReturnCase = {
      ...returnCase,
      status: "inspected",
      lines,
      inspectedAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(ref, updated);
    return updated;
  });
}

export async function linkReturnRefundCase(input: {
  returnCaseId: string;
  refundCaseId: string;
}): Promise<ReturnCase> {
  validateReturnCaseId(input.returnCaseId);
  if (!/^ORD-[A-Za-z0-9_-]{16,80}__[A-Za-z0-9_-]{8,80}$/.test(input.refundCaseId)) {
    throw new Error("INVALID_REFUND_CASE_ID");
  }
  const db = getAdminFirestore();
  const returnRef = db.collection(RETURN_CASES_COLLECTION).doc(input.returnCaseId);
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const [returnSnapshot, refundSnapshot] = await Promise.all([
      transaction.get(returnRef),
      transaction.get(refundRef),
    ]);
    if (!returnSnapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
    const returnCase = returnSnapshot.data() as ReturnCase;
    const refund = refundSnapshot.data() as { orderId?: string; customerId?: string };
    if (refund.orderId !== returnCase.orderId || refund.customerId !== returnCase.customerId) {
      throw new Error("RETURN_REFUND_MISMATCH");
    }
    if (returnCase.status !== "inspected" && returnCase.status !== "closed") throw new Error("RETURN_STATE_CONFLICT");
    if (returnCase.refundCaseId && returnCase.refundCaseId !== input.refundCaseId) throw new Error("RETURN_REFUND_ALREADY_LINKED");
    const updated: ReturnCase = { ...returnCase, refundCaseId: input.refundCaseId, updatedAt: timestamp };
    transaction.set(returnRef, updated);
    return updated;
  });
}

export async function closeReturnCase(returnCaseIdInput: string): Promise<ReturnCase> {
  validateReturnCaseId(returnCaseIdInput);
  const db = getAdminFirestore();
  const ref = db.collection(RETURN_CASES_COLLECTION).doc(returnCaseIdInput);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const returnCase = snapshot.data() as ReturnCase;
    if (returnCase.status === "closed") return returnCase;
    if (returnCase.status !== "inspected") throw new Error("RETURN_STATE_CONFLICT");
    const updated: ReturnCase = { ...returnCase, status: "closed", closedAt: timestamp, updatedAt: timestamp };
    transaction.set(ref, updated);
    return updated;
  });
}
