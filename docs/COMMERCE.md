# Commerce architecture

## Locked scope for first launch

- Market: **Italy only**.
- Currency: **EUR**.
- Customer account: **required to purchase**.
- Catalog: **continuous archive**, no drop/collection dependency.
- Checkout: disabled until feature + legal gates are both ready.

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

## Provider adapters

Domain code defines provider-neutral interfaces for:

- `PaymentProvider`;
- `InventoryRepository`;
- `OrderRepository`.

A future Stripe implementation is an adapter. UI components and order invariants must not depend directly on Stripe SDK objects.

The same rule applies to future fulfillment providers.

## Checkout state machine

Recommended first-launch flow:

1. require authenticated customer;
2. validate legal/commerce gates;
3. validate Italian shipping address;
4. load SKU, price and availability server-side;
5. calculate authoritative totals;
6. reserve inventory transactionally;
7. create pending order;
8. create provider payment with idempotency key;
9. confirm payment from signed webhook/provider state;
10. transition order to paid/processing;
11. release inventory reservation on failed/expired flows.

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

Inventory is per SKU/variant.

Maintain at least:

- `onHand`;
- `reserved`;
- version/update timestamp.

Availability = `max(0, onHand - reserved)`.

Reservation changes need transactional/atomic semantics to prevent overselling under concurrent checkout.

## Idempotency

Persist provider event IDs and checkout/payment idempotency keys.

The same webhook or client retry must not:

- charge twice;
- decrement inventory twice;
- create duplicate orders;
- send duplicate fulfillment requests.

## Cart

A pre-checkout cart can be client-friendly, but it is not authoritative.

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
