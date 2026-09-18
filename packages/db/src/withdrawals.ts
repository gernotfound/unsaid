import type {
  Order,
  ReturnCase,
  WithdrawalLineInput,
  WithdrawalNotice,
  WithdrawalScope,
} from "@unsaid/domain";
import {
  buildWithdrawalLines,
  buildWithdrawalStatement,
  normalizeWithdrawalConsumerName,
  sameWithdrawalSelection,
  WITHDRAWAL_SCOPES,
} from "@unsaid/domain";
import { REFUND_CASES_COLLECTION, type RefundCaseRecord } from "./adminOrders";
import { getAdminFirestore } from "./firebase";
import {
  buildWithdrawalAcknowledgementEmail,
  EMAIL_OUTBOX_COLLECTION,
  type EmailOutboxRecord,
  withdrawalAcknowledgementOutboxId,
} from "./notifications";
import { RETURN_CASES_COLLECTION } from "./returns";

export const WITHDRAWAL_NOTICES_COLLECTION = "withdrawalNotices";
const ORDERS_COLLECTION = "orders";
const ORDER_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const WITHDRAWAL_NOTICE_ID_PATTERN = /^withdrawal__ORD-[A-Za-z0-9_-]{16,80}__[A-Za-z0-9_-]{8,80}$/;
const RETURN_CASE_ID_PATTERN = /^return__ORD-[A-Za-z0-9_-]{16,80}$/;
const REFUND_CASE_ID_PATTERN = /^ORD-[A-Za-z0-9_-]{16,80}__[A-Za-z0-9_-]{8,80}$/;

export interface AdminWithdrawalListItem {
  withdrawalNotice: WithdrawalNotice;
  order: Order | null;
  acknowledgement: EmailOutboxRecord | null;
}

function withdrawalNoticeId(orderId: string, idempotencyKey: string) {
  return `withdrawal__${orderId}__${idempotencyKey}`;
}

function validateOrderId(value: string) {
  if (!ORDER_ID_PATTERN.test(value)) throw new Error("INVALID_ORDER_ID");
}

function validateIdempotencyKey(value: string) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) throw new Error("INVALID_IDEMPOTENCY_KEY");
}

function validateWithdrawalNoticeId(value: string) {
  if (!WITHDRAWAL_NOTICE_ID_PATTERN.test(value)) throw new Error("INVALID_WITHDRAWAL_NOTICE_ID");
}

function appendUnique(values: readonly string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function normalizeAcknowledgementEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^.{1,160}@.{1,160}$/.test(email)) throw new Error("INVALID_WITHDRAWAL_ACKNOWLEDGEMENT_EMAIL");
  return email;
}

function returnLinesCoveredByWithdrawal(withdrawal: WithdrawalNotice, returnCase: ReturnCase) {
  const quantities = new Map(withdrawal.lines.map((line) => [line.variantId, line.quantity]));
  return returnCase.lines.every((line) => (quantities.get(line.variantId) ?? 0) >= line.quantity);
}

export async function recordCustomerWithdrawalNotice(input: {
  customerId: string;
  orderId: string;
  consumerName: string;
  acknowledgementEmail: string;
  scope: WithdrawalScope;
  lines?: readonly WithdrawalLineInput[];
  idempotencyKey: string;
}): Promise<WithdrawalNotice> {
  validateOrderId(input.orderId);
  validateIdempotencyKey(input.idempotencyKey);
  if (!WITHDRAWAL_SCOPES.includes(input.scope)) throw new Error("INVALID_WITHDRAWAL_SCOPE");
  const consumerName = normalizeWithdrawalConsumerName(input.consumerName);
  const acknowledgementEmail = normalizeAcknowledgementEmail(input.acknowledgementEmail);
  const db = getAdminFirestore();
  const id = withdrawalNoticeId(input.orderId, input.idempotencyKey);
  const orderRef = db.collection(ORDERS_COLLECTION).doc(input.orderId);
  const noticeRef = db.collection(WITHDRAWAL_NOTICES_COLLECTION).doc(id);
  const outboxRef = db.collection(EMAIL_OUTBOX_COLLECTION).doc(withdrawalAcknowledgementOutboxId(id));
  const timestamp = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, noticeSnapshot, outboxSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(noticeRef),
      transaction.get(outboxRef),
    ]);
    if (!orderSnapshot.exists) throw new Error("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() as Order;
    if (order.customerId !== input.customerId) throw new Error("ORDER_FORBIDDEN");

    const lines = buildWithdrawalLines(order, input.scope, input.lines ?? []);
    if (noticeSnapshot.exists) {
      const existing = noticeSnapshot.data() as WithdrawalNotice;
      if (
        !sameWithdrawalSelection(existing, { consumerName, scope: input.scope, lines }) ||
        existing.acknowledgementTarget.destination !== acknowledgementEmail
      ) {
        throw new Error("WITHDRAWAL_IDEMPOTENCY_CONFLICT");
      }
      if (!outboxSnapshot.exists) {
        transaction.set(outboxRef, buildWithdrawalAcknowledgementEmail(existing, timestamp));
      }
      return existing;
    }

    const notice: WithdrawalNotice = {
      id,
      orderId: order.id,
      customerId: order.customerId,
      orderEmail: order.email,
      consumerName,
      scope: input.scope,
      lines,
      statement: buildWithdrawalStatement({
        orderId: order.id,
        consumerName,
        scope: input.scope,
        lines,
      }),
      statementVersion: 1,
      submissionMethod: "online_withdrawal_function",
      confirmation: {
        action: "confirm_withdrawal",
        confirmedAt: timestamp,
      },
      orderStatusAtSubmission: order.status,
      acknowledgementTarget: {
        channel: "email",
        destination: acknowledgementEmail,
      },
      acknowledgementNotificationId: outboxRef.id,
      returnCaseIds: [],
      refundCaseIds: [],
      submittedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.set(noticeRef, notice);
    transaction.set(outboxRef, buildWithdrawalAcknowledgementEmail(notice, timestamp));
    return notice;
  });
}

export async function listCustomerWithdrawals(customerId: string): Promise<readonly WithdrawalNotice[]> {
  const snapshot = await getAdminFirestore()
    .collection(WITHDRAWAL_NOTICES_COLLECTION)
    .where("customerId", "==", customerId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as WithdrawalNotice)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function listAdminWithdrawalNotices(limitInput = 75): Promise<readonly AdminWithdrawalListItem[]> {
  const db = getAdminFirestore();
  const limit = Math.min(100, Math.max(1, Math.trunc(limitInput)));
  const snapshot = await db.collection(WITHDRAWAL_NOTICES_COLLECTION).orderBy("submittedAt", "desc").limit(limit).get();
  const notices = snapshot.docs.map((doc) => doc.data() as WithdrawalNotice);
  if (!notices.length) return [];
  const orderRefs = notices.map((notice) => db.collection(ORDERS_COLLECTION).doc(notice.orderId));
  const acknowledgementRefs = notices.map((notice) =>
    db.collection(EMAIL_OUTBOX_COLLECTION).doc(notice.acknowledgementNotificationId),
  );
  const [orderSnapshots, acknowledgementSnapshots] = await Promise.all([
    db.getAll(...orderRefs),
    db.getAll(...acknowledgementRefs),
  ]);
  return notices.map((withdrawalNotice, index) => ({
    withdrawalNotice,
    order: orderSnapshots[index]?.exists ? (orderSnapshots[index]!.data() as Order) : null,
    acknowledgement: acknowledgementSnapshots[index]?.exists
      ? (acknowledgementSnapshots[index]!.data() as EmailOutboxRecord)
      : null,
  }));
}

export async function linkWithdrawalReturnCase(input: {
  withdrawalNoticeId: string;
  returnCaseId: string;
}): Promise<WithdrawalNotice> {
  validateWithdrawalNoticeId(input.withdrawalNoticeId);
  if (!RETURN_CASE_ID_PATTERN.test(input.returnCaseId)) throw new Error("INVALID_RETURN_CASE_ID");
  const db = getAdminFirestore();
  const noticeRef = db.collection(WITHDRAWAL_NOTICES_COLLECTION).doc(input.withdrawalNoticeId);
  const returnRef = db.collection(RETURN_CASES_COLLECTION).doc(input.returnCaseId);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const [noticeSnapshot, returnSnapshot] = await Promise.all([
      transaction.get(noticeRef),
      transaction.get(returnRef),
    ]);
    if (!noticeSnapshot.exists) throw new Error("WITHDRAWAL_NOTICE_NOT_FOUND");
    if (!returnSnapshot.exists) throw new Error("RETURN_CASE_NOT_FOUND");
    const notice = noticeSnapshot.data() as WithdrawalNotice;
    const returnCase = returnSnapshot.data() as ReturnCase;
    if (notice.orderId !== returnCase.orderId || notice.customerId !== returnCase.customerId) {
      throw new Error("WITHDRAWAL_RETURN_MISMATCH");
    }
    if (!returnLinesCoveredByWithdrawal(notice, returnCase)) {
      throw new Error("WITHDRAWAL_RETURN_LINES_MISMATCH");
    }
    if (returnCase.withdrawalNoticeId && returnCase.withdrawalNoticeId !== notice.id) {
      throw new Error("RETURN_WITHDRAWAL_ALREADY_LINKED");
    }
    const updated: WithdrawalNotice = {
      ...notice,
      returnCaseIds: appendUnique(notice.returnCaseIds, returnCase.id),
      updatedAt: timestamp,
    };
    transaction.set(noticeRef, updated);
    if (returnCase.withdrawalNoticeId !== notice.id) {
      transaction.set(returnRef, {
        ...returnCase,
        withdrawalNoticeId: notice.id,
        updatedAt: timestamp,
      } satisfies ReturnCase);
    }
    return updated;
  });
}

export async function linkWithdrawalRefundCase(input: {
  withdrawalNoticeId: string;
  refundCaseId: string;
}): Promise<WithdrawalNotice> {
  validateWithdrawalNoticeId(input.withdrawalNoticeId);
  if (!REFUND_CASE_ID_PATTERN.test(input.refundCaseId)) throw new Error("INVALID_REFUND_CASE_ID");
  const db = getAdminFirestore();
  const noticeRef = db.collection(WITHDRAWAL_NOTICES_COLLECTION).doc(input.withdrawalNoticeId);
  const refundRef = db.collection(REFUND_CASES_COLLECTION).doc(input.refundCaseId);
  const timestamp = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
    const [noticeSnapshot, refundSnapshot] = await Promise.all([
      transaction.get(noticeRef),
      transaction.get(refundRef),
    ]);
    if (!noticeSnapshot.exists) throw new Error("WITHDRAWAL_NOTICE_NOT_FOUND");
    if (!refundSnapshot.exists) throw new Error("REFUND_CASE_NOT_FOUND");
    const notice = noticeSnapshot.data() as WithdrawalNotice;
    const refundCase = refundSnapshot.data() as RefundCaseRecord;
    if (notice.orderId !== refundCase.orderId || notice.customerId !== refundCase.customerId) {
      throw new Error("WITHDRAWAL_REFUND_MISMATCH");
    }
    if (notice.refundCaseIds.includes(refundCase.id)) return notice;
    const updated: WithdrawalNotice = {
      ...notice,
      refundCaseIds: appendUnique(notice.refundCaseIds, refundCase.id),
      updatedAt: timestamp,
    };
    transaction.set(noticeRef, updated);
    return updated;
  });
}
