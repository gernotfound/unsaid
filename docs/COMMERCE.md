# Commerce architecture

## Locked scope for first launch

- Market: **Italy only**.
- Currency: **EUR**.
- Customer account: **required to purchase**.
- Verified email: **required before checkout**.
- Catalog: **continuous archive**, no drop/collection dependency.
- Checkout: disabled until feature + legal gates are both ready.

## Current implementation

The commerce domain and Firestore repository layer now exist even though checkout/payment UI remains disabled.

Implemented server contracts/repositories:

- `SellableProduct` and `SellableVariant` / SKU;
- `FirestoreSellableProductRepository`;
- `InventorySnapshot` (`onHand`, `reserved`);
- transaction-backed `FirestoreInventoryRepository`;
- idempotent inventory reservation records;
- reserve / release / commit inventory operations;
- `Order` and `FirestoreOrderRepository`;
- customer-scoped order listing;
- checkout eligibility policy (feature gate + account + verified email + IT-only shipping).

No payment provider is wired yet and no browser route can authoritatively create an order.

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

The planned/current server-side commerce collections are:

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

## Checkout state machine

Recommended first-launch flow:

1. require authenticated customer session;
2. require verified email;
3. validate legal/commerce gates;
4. validate Italian shipping address;
5. load SKU, price and availability server-side;
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

## Idempotency

Persist provider event IDs and checkout/payment idempotency keys when payment integration is added.

The same webhook or client retry must not:

- charge twice;
- decrement inventory twice;
- create duplicate orders;
- send duplicate fulfillment requests.

## Cart

A pre-checkout cart can remain client-friendly, but it is not authoritative.

At checkout the server re-resolves:

- product active state;
- variant;
- current price;
- stock;
- shipping eligibility;
- totals.

## Returns/refunds

Return/refund state is separate from the creative catalog.

Before launch define:

- withdrawal/return eligibility and timing;
- return shipment process;
- refund state transitions;
- restock policy;
- partial refund behavior.

The final rules must match the legal pages and actual operating process.
