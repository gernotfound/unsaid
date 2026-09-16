import type { Money, Order, ShipmentRecord } from "@unsaid/domain";

export const EMAIL_OUTBOX_COLLECTION = "emailOutbox";

export type EmailNotificationKind = "order_confirmation" | "shipment_confirmation";
export type EmailOutboxStatus = "queued" | "sending" | "sent" | "failed";

export interface EmailOutboxRecord {
  id: string;
  kind: EmailNotificationKind;
  orderId: string;
  customerId: string;
  toEmail: string;
  status: EmailOutboxStatus;
  payload: {
    orderTotal: Money;
    orderStatus: Order["status"];
    shipment?: {
      provider: string;
      trackingCode?: string;
      trackingUrl?: string;
    };
  };
  attempts: number;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

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
  shipment: ShipmentRecord,
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
