# UNSAID — Fulfillment and customer notifications

## Scope

Phase-one fulfillment is Italy-only and remains server-authoritative. The admin UI never writes Firestore shipment/order state directly.

Operational flow:

```text
paid -> processing -> shipped -> delivered
```

`manual_review` payment cases are not fulfillment candidates. An operator must reconcile payment and inventory before dispatch.

## Shipment state

One phase-one shipment record is stored per order in:

```text
shipments/shipment__{orderId}
```

The record snapshots:

- order/customer relationship;
- carrier/provider label;
- tracking code;
- optional HTTPS tracking URL;
- shipment status;
- shipped/delivered timestamps;
- created/updated timestamps.

The admin flow lives at `/admin/fulfillment`.

### Prepare

An order must already be `processing` and its server-side payment record must still be `paid`.

The operator may save carrier details as `ready` before dispatch. This does not tell the customer that the parcel has left.

### Ship

`shipped` requires:

- order currently `processing`;
- payment still `paid`;
- valid carrier/provider;
- tracking code;
- optional tracking URL using HTTPS.

Order + shipment are updated in the same Firestore transaction. A deterministic `shipment_confirmation` outbox event is created in the same transaction, so retrying the admin action does not create duplicate customer notifications.

### Deliver

Only a `shipped` order/shipment can transition to `delivered`. The order and shipment are updated together.

## Customer account

The account order history includes the server-side shipment status. When available it displays:

- carrier;
- shipment state;
- tracking code;
- HTTPS tracking link.

The account data export also includes fulfillment records.

## Transactional email outbox

Customer emails are represented as server-only records in:

```text
emailOutbox/{notificationId}
```

Current kinds:

- `order_confirmation`;
- `shipment_confirmation`.

The IDs are deterministic per order/event, making enqueue operations idempotent.

The order-confirmation event is queued when a paid order is accepted into `processing`. The shipment-confirmation event is queued atomically with the `shipped` transition.

Outbox states are designed for a future asynchronous dispatcher:

```text
queued -> sending -> sent
                  -> failed
```

No external email provider is connected yet. A queued record therefore means **notification prepared, not email delivered**.

## Email provider boundary

`apps/worker/src/email.ts` defines the provider-neutral boundary and phase-one text renderers. A future provider adapter must implement `EmailProvider.send(message, idempotencyKey)` and persist the provider message ID only after successful delivery.

Do not place provider API keys in browser/runtime-public variables. Delivery credentials must remain server/worker secrets.

Before enabling delivery, test at minimum:

- idempotent retries;
- provider timeout after an ambiguous response;
- invalid recipient handling;
- bounce/failure reconciliation;
- order-confirmation rendering;
- shipment tracking rendering;
- no email for `manual_review` or unpaid orders.
