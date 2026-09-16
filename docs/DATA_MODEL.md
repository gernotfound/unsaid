# UNSAID — Data model

## Current editorial store

### `catalog/{id}`

Canonical private editorial aggregate for one T-shirt.

Contains permanent ID/sequence, stable slug, title/front/back copy, language/category/internal audience classification, lifecycle, primary view, front/back media state, garment fit/color, transitional optional display price, internal notes, revision/timestamps and admin search tokens.

A save is atomic and revisioned.

### `publicCatalog/{id}`

Public projection for records with `status: published`. Internal notes/revision are omitted. Anonymous storefront traffic does not read this collection directly; Next.js reads it server-side through Firebase Admin.

### `slugs/{slug}`

Uniqueness lock/tombstone. Public slugs are not reused.

### `meta/catalog`

Sequence allocator and bounded aggregate counters.

### `admins/{uid}`

Additional admin allowlist. Admin authorization never comes from a customer-controlled profile field.

## Customer account model

Firebase Auth owns credentials/identity proof.

### `customers/{uid}`

Application profile metadata only:

- UID;
- email;
- optional display name;
- account status;
- default shipping address reference;
- created/updated timestamps.

Passwords, ID tokens and session cookies are never stored here.

### `customers/{uid}/addresses/{addressId}`

Saved customer addresses. Initial constraint: `country = IT`, five-digit CAP, two-letter province code. Up to ten addresses are currently accepted per account.

A saved address is mutable convenience data. Orders never depend on it after checkout preparation; the order stores its own immutable shipping snapshot.

Browser Firestore access to customer documents is denied. Account APIs verify the HttpOnly/Firebase server session and use Firebase Admin.

## Commerce model

Commercial state is separate from `catalog`.

### `sellableProducts/{catalogId}`

- active state;
- price as integer EUR cents;
- tax classification/reference;
- selected phase-one garment color (`white` or `black`);
- updated timestamp.

The editorial `priceCents` field is transitional and must not be the checkout source of truth.

### `variants/{variantId}`

One permanent sellable SKU:

- `catalogId`;
- deterministic SKU/variant ID;
- size;
- garment color;
- active state.

Phase-one sizes are `XS`, `S`, `M`, `L`, `XL`, `XXL`. Phase-one garment colors are white / black.

SKU examples:

```text
UNS-0001-WHT-M
UNS-0001-BLK-XL
```

Switching a product to another garment color does not delete old variants; obsolete variants are deactivated so historical references remain stable.

### `inventory/{variantId}`

Mutable inventory state:

- `onHand`;
- `reserved`;
- updated timestamp.

Available stock is `max(0, onHand - reserved)`. Admin stock edits cannot set `onHand` below the already reserved quantity.

### `inventoryReservations/{orderId}__{variantId}`

Transaction/idempotency record tying stock reservation to one order + SKU. Stores quantity, lifecycle timestamps and the reservation expiry.

States:

- `active` — quantity reserved but not consumed;
- `released` — reservation returned to availability;
- `committed` — stock deducted from on-hand after confirmed purchase state.

Reservation/inventory changes run in Firestore transactions.

### `orders/{orderId}`

Immutable commercial snapshot plus lifecycle:

- `customerId`;
- checkout email;
- shipping-address snapshot;
- order-line/SKU/title/size/color snapshots;
- authoritative unit-price snapshots;
- shipping method/cost snapshot;
- VAT configuration snapshot;
- subtotal/included-tax/shipping/gross-total snapshots;
- reservation expiry;
- status;
- timestamps.

Pre-payment preparation creates `pending_payment`; it does not mean money was collected. Changing a product title, customer address, current price or shipping configuration later must not rewrite an existing order.

Operational order states currently include `pending_payment`, `paid`, `processing`, `shipped`, `delivered`, `cancelled` and `refunded`. Guarded admin transitions cover payment acceptance into `processing`, shipment dispatch, delivery and full-refund completion. Pending cancellation remains protected by the payment-session guard.

### `checkoutAttempts/{customerId}__{idempotencyKey}`

Server-only idempotency ledger for order preparation. It links one customer/request fingerprint to one deterministic pending order and its expiry. Reusing the same key for a different cart/address/configuration is rejected.

### `paymentSessionIntents/{orderId}`

Server-only lock/state record for Stripe Checkout Session creation. It prevents duplicate provider sessions, protects inventory while a payment is in flight and carries the provider/session expiry windows.

### `payments/{paymentId}`

Provider payment lifecycle linked to one order. It stores provider IDs, authoritative amount and payment state only; raw card data is never stored.

Current Stripe records use deterministic IDs such as `stripe__{orderId}` and may enter `manual_review` when the provider reports paid but the internal amount/session/reservation state does not reconcile safely. Refund execution can add the cumulative confirmed `refundedAmount`; a full refund also transitions the payment/order to refunded state.

### `webhookEvents/{providerEventId}`

Server-only idempotency ledger for processed Stripe webhook events. Duplicate payment/refund webhook delivery cannot commit stock or refund accounting twice.

### `refundCases/{orderId}__{idempotencyKey}`

Administrative refund case record. A case contains:

- order/customer/payment references;
- requested EUR amount;
- operator reason;
- requesting/executing admin UID;
- case status and execution state;
- explicit provider-action state;
- Stripe refund ID/status when created;
- bounded provider failure/review information;
- timestamps.

Creating a refund case **does not move money**. Stripe execution is a separate guarded admin action.

### `refundControls/{orderId}`

Server-only concurrency control for refund execution. It stores:

- original authoritative payment amount;
- cumulative confirmed refunded cents;
- cents currently locked in an in-flight provider refund;
- updated timestamp.

A Firestore transaction reserves the requested amount before calling Stripe. This prevents two concurrent admin actions from refunding more than the original payment. Ambiguous provider/network outcomes keep the amount in-flight until webhook/manual reconciliation rather than releasing it for a second attempt.

### `shipments/shipment__{orderId}`

Phase-one fulfillment record. One shipment is associated with one order and stores:

- order/customer references;
- carrier/provider label;
- tracking code;
- optional HTTPS tracking URL;
- `ready`, `shipped`, `delivered` or later return state;
- shipped/delivered timestamps;
- created/updated timestamps.

`processing -> shipped` updates the order and shipment in the same Firestore transaction. `shipped -> delivered` is also transactional.

### `emailOutbox/{notificationId}`

Server-only transactional-email outbox. Current deterministic event IDs represent:

- order confirmation;
- shipment confirmation.

Each record stores event kind, order/customer references, destination email, a bounded rendering payload, delivery status/attempt metadata and timestamps. A queued outbox record is not proof that an external email provider delivered a message.

## Admin operations read model

`/admin/orders`, `/admin/fulfillment` and `/admin/refunds` are backed exclusively by server-side Firebase Admin reads. The browser supplies a Firebase ID token only to authenticate the administrator; order, payment, reservation, refund, refund-control, shipment and notification-outbox documents remain server-authoritative and inaccessible through browser Firestore writes.

The consoles correlate the relevant server records so operators can see payment state, inventory reservations, refund cases, refund execution, shipment state and notification state without making client-side documents authoritative.

## Catalog mode

UNSAID uses a **continuous archive**. There is no drop/collection aggregate and public URLs do not assume one.

If collections are introduced later, add them as an editorial projection referencing stable catalog IDs rather than changing product identity.

## Join keys

- stable editorial `catalogId` bridges creative identity to sellable product/variants;
- Firebase Auth `uid` is customer identity;
- order/payment/shipment IDs are independent immutable business IDs;
- checkout idempotency keys are request-scoped technical identifiers and are not payment proof;
- refund-case idempotency keys identify an administrative refund request;
- Stripe refund metadata links provider refunds back to refund-case/order IDs;
- deterministic outbox IDs make customer-notification enqueue operations idempotent.
