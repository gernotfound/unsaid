import type { Money, Order, ShipmentRecord, WithdrawalNotice } from "@unsaid/domain";

export const EMAIL_OUTBOX_COLLECTION = "emailOutbox";

export type EmailNotificationKind = "order_confirmation" | "shipment_confirmation" | "withdrawal_acknowledgement";
export type EmailOutboxStatus = "queued" | "sending" | "sent" | "failed";

interface EmailOutboxBase {
  id: string;
  orderId: string;
  customerId: string;
  toEmail: string;
  status: EmailOutboxStatus;
  attempts: number;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export type EmailOutboxRecord =
  | (EmailOutboxBase & {
      kind: "order_confirmation";
      payload: {
        orderTotal: Money;
        orderStatus: "paid";
      };
    })
  | (EmailOutboxBase & {
      kind: "shipment_confirmation";
      payload: {
        orderTotal: Money;
        orderStatus: "shipped";
        shipment: {
          provider: string;
          trackingCode?: string;
          trackingUrl?: string;
        };
      };
    })
  | (EmailOutboxBase & {
      kind: "withdrawal_acknowledgement";
      payload: {
        withdrawalNoticeId: string;
        consumerName: string;
        statement: string;
        submittedAt: string;
        orderStatusAtSubmission: Order["status"];
      };
    });

export type NotificationShipment = ShipmentRecord & {
  trackingUrl?: string;
};

function safeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^.{1,160}@.{1,160}$/.test(email)) throw new Error("INVALID_NOTIFICATION_EMAIL");
  return email;
}

export function orderConfirmationOutboxId(orderId: string) {
  return `order_confirmation__${orderId}`;
}

export function shipmentConfirmationOutboxId(orderId: string) {
  return `shipment_confirmation__${orderId}`;
}

export function withdrawalAcknowledgementOutboxId(withdrawalNoticeId: string) {
  return `withdrawal_acknowledgement__${withdrawalNoticeId}`;
}

export function buildOrderConfirmationEmail(order: Order, timestamp: string): EmailOutboxRecord {
  return {
    id: orderConfirmationOutboxId(order.id),
    kind: "order_confirmation",
    orderId: order.id,
    customerId: order.customerId,
    toEmail: safeEmail(order.email),
    status: "queued",
    payload: {
      orderTotal: order.totals.total,
      orderStatus: "paid",
    },
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildShipmentConfirmationEmail(
  order: Order,
  shipment: NotificationShipment,
  timestamp: string,
): EmailOutboxRecord {
  return {
    id: shipmentConfirmationOutboxId(order.id),
    kind: "shipment_confirmation",
    orderId: order.id,
    customerId: order.customerId,
    toEmail: safeEmail(order.email),
    status: "queued",
    payload: {
      orderTotal: order.totals.total,
      orderStatus: "shipped",
      shipment: {
        provider: shipment.provider,
        ...(shipment.trackingCode ? { trackingCode: shipment.trackingCode } : {}),
        ...(shipment.trackingUrl ? { trackingUrl: shipment.trackingUrl } : {}),
      },
    },
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildWithdrawalAcknowledgementEmail(
  withdrawal: WithdrawalNotice,
  timestamp: string,
): EmailOutboxRecord {
  return {
    id: withdrawalAcknowledgementOutboxId(withdrawal.id),
    kind: "withdrawal_acknowledgement",
    orderId: withdrawal.orderId,
    customerId: withdrawal.customerId,
    toEmail: safeEmail(withdrawal.acknowledgementTarget.destination),
    status: "queued",
    payload: {
      withdrawalNoticeId: withdrawal.id,
      consumerName: withdrawal.consumerName,
      statement: withdrawal.statement,
      submittedAt: withdrawal.submittedAt,
      orderStatusAtSubmission: withdrawal.orderStatusAtSubmission,
    },
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
