# Commerce architecture

## Locked scope for first launch

- Market: **Italy only**.
- Currency: **EUR**.
- Customer account: **required to purchase**.
- Verified email: **required before checkout**.
- Catalog: **continuous archive**, no drop/collection dependency.
- Checkout: disabled until feature + legal gates are both ready.

## Current implementation

The commerce domain and Firestore repository layer now exist even though checkout/payment remains disabled.

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
- server-side public commerce projection for product pages;
- `/cart` with browser-local SKU/quantity state;
- `/api/cart/validate` for authoritative price, product and stock re-resolution.

No payment provider is wired yet and no browser route can authoritatively create an order.

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

The product page receives only the public sale projection it needs:

- current EUR price;
- garment color;
- active sizes / SKU identifiers;
- currently available quantity (`onHand - reserved`).

Inactive commerce records are treated as archive-only products.

## Separation of concerns

`CatalogRecord` is the editorial identity of a shirt.

Commercial state belongs elsewhere:

```text
CatalogRecord
  -> SellableProduct
      -> SellableVariant / SKU
          -> Inventory

Customer
  -> Order
      -> Payment
      -> Shipment
```

Price and stock updates must not create editorial revisions.

## Firestore collections

The current/planned server-side commerce collections are:

- `sellableProducts/{catalogId}`;
- `variants/{variantId}`;
- `inventory/{variantId}`;
- `inventoryReservations/{orderId}__{variantId}`;
- `orders/{orderId}`;
- future `payments/{paymentId}`;
- future `shipments/{shipmentId}`.

Browser Firestore access to these collections is denied. Firebase Admin on the application server is the authority.

## Provider adapters

Domain code defines provider-neutral interfaces for:

- `PaymentProvider`;
- `SellableProductRepository`;
- `InventoryRepository`;
- `OrderRepository`.

A future Stripe implementation is an adapter. UI components and order invariants must not depend directly on Stripe SDK objects.

The same rule applies to future fulfillment providers.

## Cart trust boundary

The cart is intentionally client-friendly but non-authoritative.

The browser stores only:

- `variantId`;
- `catalog/productId` for local identity/display fallback;
- size;
- quantity.

It does **not** persist a trusted sale price or total.

Whenever `/cart` loads or quantity changes, `/api/cart/validate` re-resolves through Firebase Admin:

- the variant exists and is active;
- the parent sellable product exists and is active;
- the product is still published;
- garment color still matches the sellable product;
- current EUR unit price;
- current `onHand - reserved` availability;
- authoritative line total and subtotal.

Invalid, unpublished, inactive or out-of-stock lines are not accepted as valid cart lines. Local storage can be edited by the user without gaining authority over server data.

Cart validation does not reserve inventory. Reservation happens only when a future server-side checkout creates a real pending order.

## Checkout state machine

Recommended first-launch flow:

1. require authenticated customer session;
2. require verified email;
3. validate legal/commerce gates;
4. validate Italian shipping address;
5. revalidate cart SKU, price and availability server-side;
6. calculate authoritative totals;
7. reserve inventory transactionally;
8. create pending order;
9. create provider payment with idempotency key;
10. confirm payment from signed webhook/provider state;
11. commit reserved stock after confirmed payment;
12. transition order to paid/processing;
13. release reservation on failed/expired flows.

Never mark an order paid from a browser callback alone.

## Italy-only boundary

Country expansion is intentionally not generic at first.

- UI exposes Italy only.
- Domain policy accepts `IT` only.
- Server rejects non-IT shipping addresses.
- Shipping methods are selected only from Italian destinations.
- Currency remains EUR.

Do not hard-code a VAT percentage into the domain until the real business/tax configuration is confirmed. Prices/tax presentation must be reviewed before sales launch.

## Inventory

Inventory is per SKU/variant and stores:

- `onHand`;
- `reserved`;
- update timestamp.

Availability = `max(0, onHand - reserved)`.

Reservations are separate documents tied to order + variant. The repository treats repeated reserve/commit calls idempotently when they refer to the same reservation and rejects conflicting quantities. All reservation/inventory mutations use Firestore transactions.

Administrative stock edits also use a transaction and preserve the current reserved quantity. If a requested on-hand value is lower than reserved stock, the mutation fails instead of silently corrupting availability.

## Idempotency

Persist provider event IDs and checkout/payment idempotency keys when payment integration is added.

The same webhook or client retry must not:

- charge twice;
- decrement inventory twice;
- create duplicate orders;
- send duplicate fulfillment requests.

## Returns/refunds

Return/refund state is separate from the creative catalog.

Before launch define:

- withdrawal/return eligibility and timing;
- return shipment process;
- refund state transitions;
- restock policy;
- partial refund behavior.

The final rules must match the legal pages and actual operating process.
