# Commerce architecture

## Locked scope for first launch

- Market: **Italy only**.
- Currency: **EUR**.
- Customer account: **required to purchase**.
- Verified email: **required before checkout**.
- Catalog: **continuous archive**, no drop/collection dependency.
- Checkout/payment: fail closed until feature, legal, shipping and tax gates are all ready.

## Current implementation

The commerce domain, storefront projection, cart validation and pre-payment checkout foundation now exist. Stripe/payment remains disconnected.

Implemented server contracts/repositories:

- `SellableProduct` and `SellableVariant` / SKU;
- `FirestoreSellableProductRepository`;
- `InventorySnapshot` (`onHand`, `reserved`);
- transaction-backed `FirestoreInventoryRepository`;
- idempotent inventory reservation records;
- reserve / release / commit inventory operations;
- `Order` and `FirestoreOrderRepository`;
- customer-scoped order listing;
- checkout eligibility policy (feature gate + account + verified email + IT-only shipping);
- `/admin/commerce` control room for price, color, sizes, SKU and on-hand stock;
- server-verified admin API for commerce mutations;
- server-side public commerce projection for product/archive pages;
- `/cart` with browser-local SKU/quantity state;
- `/api/cart/validate` for authoritative price, product and stock re-resolution;
- `/checkout` pre-payment flow;
- `/api/checkout/prepare` for atomic pending-order creation + stock reservation;
- `/api/checkout/cancel` for customer-owned pending-order cancellation + stock release.

No payment provider is wired and no route can mark an order paid.

## Admin commerce control

`/admin/commerce` is separate from the editorial catalog editor. It configures commercial state without creating a new editorial revision.

The first-launch garment rules are deliberately narrow:

- one sellable garment color per product: `white` or `black`;
- sizes: `XS`, `S`, `M`, `L`, `XL`, `XXL`;
- deterministic SKU format, e.g. `UNS-0001-WHT-M` or `UNS-0001-BLK-XL`;
- stock is stored per SKU;
- reserved stock is read-only in the admin UI;
- an admin cannot reduce `onHand` below `reserved`;
- activating sale requires a published catalog record, approved front/back media, a positive price and at least one active size.

Changing garment color creates/activates the deterministic variants for the selected color and deactivates old variants instead of deleting them. Historical IDs therefore remain available for order snapshots and audit work.

The browser never receives direct Firestore write access to commerce collections. The admin UI sends a fresh Firebase ID token to a server endpoint; the server verifies admin authorization and performs Firebase Admin transactions.

## Storefront commerce projection

A public product page never treats the editorial `CatalogRecord.priceCents` field as a sale price.

For a product to expose commerce state, the server requires:

- the product to exist in `publicCatalog`;
- `sellableProducts/{catalogId}` to exist and be active;
- an EUR price greater than zero;
- active variants matching the configured garment color.

The product page receives only the public sale projection it needs: current EUR price, garment color, active sizes/SKU identifiers and current availability (`onHand - reserved`). Inactive commerce records remain archive-only products.

## Cart trust boundary

The browser cart is intentionally non-authoritative. It stores only variant/product identity, size and quantity; it does not persist a trusted price or total.

Whenever `/cart` loads or quantity changes, `/api/cart/validate` re-resolves through Firebase Admin:

- active variant;
- active parent sellable product;
- still-published catalog projection;
- configured garment color;
- current EUR unit price;
- current `onHand - reserved` availability;
- authoritative line total and subtotal.

Cart validation does not reserve inventory.

## Pre-payment checkout

`/checkout` is the next trust boundary. It requires:

1. an authenticated server session;
2. a verified email;
3. a saved customer-owned Italian shipping address;
4. a valid cart;
5. shop/legal gates;
6. explicit server-side shipping + VAT configuration;
7. `CHECKOUT_PREPAYMENT_ENABLED=true`.

The endpoint ignores browser prices/totals. Inside one Firestore transaction it re-reads variants, sellable products, public catalog records and inventory, computes totals, increments reserved stock, creates deterministic reservation records and writes one `pending_payment` order.

The same idempotency key cannot create duplicate orders. A retry with the same key + same checkout request returns the existing order; conflicting reuse is rejected.

The pending order snapshots:

- customer + checkout email;
- shipping address;
- SKU/title/size/color/quantity;
- server price;
- shipping method/cost;
- VAT rate configuration used for the calculation;
- subtotal, included VAT component and gross total;
- reservation expiry.

`/api/checkout/cancel` only permits the owning customer to cancel an order still in `pending_payment`. It releases active reservations transactionally and marks the order `cancelled`.

## Shipping and VAT configuration

No shipping price or VAT percentage is guessed in code. Checkout preparation stays disabled until these are configured:

```env
CHECKOUT_PREPAYMENT_ENABLED=false
COMMERCE_STANDARD_SHIPPING_CENTS=
COMMERCE_FREE_SHIPPING_THRESHOLD_CENTS=
COMMERCE_VAT_RATE_BPS=
COMMERCE_RESERVATION_MINUTES=15
```

Consumer-facing product/shipping values are treated as gross prices. `COMMERCE_VAT_RATE_BPS` is used to snapshot the included VAT component with:

```text
included VAT = gross total × rate / (100% + rate)
```

The configured VAT treatment must be reviewed against the real business/tax setup before checkout is enabled. The phase-one implementation assumes one configured VAT rate for the order total; do not enable it if that assumption does not match the actual tax treatment.

## Reservation lifecycle

Inventory is per SKU and stores `onHand`, `reserved` and update timestamp. Availability is `max(0, onHand - reserved)`.

Checkout reservations include an expiry timestamp. Manual cancellation releases them immediately. Before enabling checkout in production, an automated expiry sweeper/worker must also be operational so abandoned pending orders cannot hold stock indefinitely.

Confirmed payment will later commit the reservation: decrement `onHand`, decrement `reserved`, mark reservation `committed`, then move the order to paid/processing. Failed/expired payment will release the reservation.

## Separation of concerns

```text
CatalogRecord
  -> SellableProduct
      -> SellableVariant / SKU
          -> Inventory
             -> InventoryReservation

Customer
  -> Order
      -> Payment
      -> Shipment
```

Price, stock and payment state never rewrite the editorial product identity.

## Firestore collections

Current/planned commerce collections:

- `sellableProducts/{catalogId}`;
- `variants/{variantId}`;
- `inventory/{variantId}`;
- `inventoryReservations/{orderId}__{variantId}`;
- `orders/{orderId}`;
- `checkoutAttempts/{customerId}__{idempotencyKey}`;
- future `payments/{paymentId}`;
- future `shipments/{shipmentId}`;
- future `webhookEvents/{providerEventId}`.

Browser Firestore access to these collections is denied. Firebase Admin on the application server is the authority.

## Payment state machine — next stage

The remaining first-launch flow is:

1. create provider payment for an existing `pending_payment` order;
2. use an idempotency key;
3. verify signed provider webhooks;
4. persist webhook event IDs;
5. on confirmed payment, commit reservations and move order to `paid`/`processing`;
6. on failed/expired payment, release reservations;
7. never trust a browser redirect as proof of payment.

Stripe will be a `PaymentProvider` adapter; UI/order invariants must not depend on Stripe SDK objects.

## Returns/refunds

Return/refund state remains separate from the creative catalog. Before launch define withdrawal/return eligibility, return shipping, refund transitions, restock policy and partial refunds, and keep the legal pages synchronized with the actual operating process.
