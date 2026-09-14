# UNSAID — Data model

## Current editorial store

### `catalog/{id}`

Canonical private editorial aggregate for one T-shirt.

Contains:

- permanent `id` and numeric `sequence`;
- stable unique `slug`;
- title and front/back copy;
- language/category/internal audience classification;
- lifecycle state;
- primary view;
- front/back media state;
- garment fit/color;
- transitional optional display price;
- internal notes;
- revision/timestamps;
- indexed admin search tokens.

A save is atomic and revisioned.

### `publicCatalog/{id}`

Public projection for records with `status: published`.

Internal notes/revision are omitted. Anonymous storefront traffic does not read this collection directly; Next.js reads it server-side through Firebase Admin.

### `slugs/{slug}`

Uniqueness lock/tombstone. Public slugs are not reused.

### `meta/catalog`

Sequence allocator and bounded aggregate counters.

### `admins/{uid}`

Additional admin allowlist. Admin authorization never comes from a customer-controlled profile field.

## Customer account model — future checkout

Firebase Auth owns credentials/identity proof.

Firestore/application data is separate:

### `customers/{uid}`

Profile metadata only:

- normalized email/reference;
- display name if provided;
- account status;
- default shipping address reference;
- created/updated timestamps.

Do not store passwords or Firebase tokens.

### `customers/{uid}/addresses/{addressId}`

Saved customer addresses.

Initial constraint: `country = IT`.

A saved address is mutable convenience data. Orders never depend on it after purchase; the order stores its own immutable shipping snapshot.

Browser Firestore access to customer documents should remain closed initially. Account APIs/server actions verify Firebase identity and perform server-side reads/writes.

## Commerce model — introduced before checkout

The following are separate from `catalog`.

### `sellableProducts/{catalogId}`

Commercial state for an editorial product:

- active;
- gross/unit price in integer euro cents;
- currency `EUR`;
- tax classification/reference;
- updated timestamp.

The current editorial `priceCents` field is transitional and must stop being the checkout source of truth before sales open.

### `variants/{variantId}`

One sellable SKU:

- `catalogId`;
- permanent SKU;
- size;
- garment color;
- active state.

Phase-one garment colors: white / black.

### `inventory/{variantId}`

Mutable inventory state:

- on hand;
- reserved;
- updated timestamp/version.

Available stock is derived from `onHand - reserved`, never accepted from the browser.

### `orders/{orderId}`

Immutable commercial snapshot plus lifecycle:

- `customerId`;
- checkout email;
- shipping-address snapshot;
- order-line snapshots;
- price/tax/shipping/total snapshots;
- status;
- timestamps.

Changing a product title, customer address or current price later must not rewrite history.

### `payments/{paymentId}`

Provider-neutral payment record linked to one order.

Store provider IDs/status/amount only. Never store raw card data.

### `shipments/{shipmentId}`

Fulfillment record linked to an order:

- provider;
- tracking reference;
- status;
- shipment/delivery timestamps.

### `webhookEvents/{providerEventId}`

Idempotency ledger for processed external payment/fulfillment events.

## Catalog mode

UNSAID currently uses a **continuous archive**. There is no drop/collection aggregate and public URLs should not assume one.

If collections are introduced later, add them as an editorial projection that references stable catalog IDs rather than changing product identity.

## Join keys

The stable editorial `catalogId` is the bridge from creative product identity to sellable product/variants.

Customer identity uses Firebase Auth `uid`.

Order/payment/shipment IDs are independent immutable business IDs.
