# UNSAID — Returns / RMA

## Scope

The return workflow is separate from legal withdrawal and refund execution.

```text
customer RMA request -> approval -> inbound transit -> received -> inspected -> closed
```

A legal withdrawal declaration is recorded separately in `withdrawalNotices`. A physical return is **not** proof that money was refunded. A refund is **not** proof that a garment is physically back in sellable inventory.

See `docs/WITHDRAWALS.md` for the legal online-withdrawal foundation.

## Feature gates

Customer RMA requests stay fail-closed until both server-side gates are enabled:

```text
RETURNS_ENABLED=true
RETURNS_POLICY_READY=true
```

`RETURNS_POLICY_READY` must remain false until the published return policy and its legal/business rules have been reviewed. The RMA implementation deliberately does not hard-code statutory withdrawal timing or shipping-refund entitlement; those concerns belong to the withdrawal/legal/refund layers.

Admin RMA operations remain available for existing records even if customer request intake is disabled.

## Customer request

Phase one supports one RMA record per order:

```text
returnCases/return__{orderId}
```

A request is accepted only when:

- the customer owns the order;
- the order is `delivered`;
- the server-side shipment is also `delivered`;
- every requested SKU exists in the immutable order snapshot;
- every requested quantity is positive and does not exceed the purchased quantity;
- no different RMA already exists for the same order.

Repeated delivery of the same request body is idempotent.

The customer can see the RMA state from `/account`. Browser Firestore access remains denied; the account page and API use the verified server session and Firebase Admin.

## Operational states

- `requested` — customer RMA request recorded;
- `approved` — operator accepted the physical return workflow;
- `rejected` — operator rejected the RMA workflow;
- `in_transit` — return shipment is on the way back, optionally with carrier/tracking metadata; `inTransitAt` records the transition;
- `received` — parcel physically received;
- `inspected` — received quantities and restock quantities were recorded;
- `closed` — RMA operationally closed.

These states do not determine whether a legal withdrawal declaration was received or timely.

The admin console is `/admin/returns`.

## Inspection and inventory

Inspection is line-specific. For every returned SKU the operator records:

- requested quantity;
- physically received quantity;
- quantity safe to restock.

Invariant:

```text
0 <= restockQuantity <= receivedQuantity <= requestedQuantity
```

Only `restockQuantity` increments `inventory/{variantId}.onHand`. The transaction updates inventory and the RMA together. Reserved stock is not modified by the return flow.

Identical inspection retries after `inspected` or `closed` are recognized as idempotent and return the stored RMA without incrementing inventory again. A retry that changes received/restock quantities is rejected as a conflict.

A garment that was refunded but not physically received/approved for resale never returns to stock automatically.

## Withdrawal linkage

An RMA can optionally link to one `withdrawalNoticeId`. Linking verifies the same order/customer and that the RMA line quantities are covered by the withdrawal notice.

The relationship is metadata only. RMA approval/rejection does not approve/reject the legal declaration.

## Refund linkage

After inspection an RMA can link to an existing `refundCases/{refundCaseId}` record. The server verifies that return and refund refer to the same order and customer.

The RMA layer does not decide the refund amount, shipping reimbursement or legal entitlement. Those remain in the refund/legal policy layer. This avoids encoding an unreviewed return policy into inventory logic.

## Data export and privacy

Customer account export uses a dedicated `customerId` query for all RMA records rather than deriving returns only from the dashboard's bounded order list. This prevents older RMAs from disappearing solely because the related order is outside the normal 50-order UI window.

Return records can contain reason text and operational shipment metadata. Keep free-text notes bounded and do not use the RMA record for unnecessary sensitive information.

## Pre-launch validation

Before enabling public RMA intake, test at minimum:

- delivered-order request;
- rejection of shipped/processing orders;
- quantity greater than purchased;
- duplicate request retry;
- conflicting second request for the same order;
- approval and inbound tracking + `inTransitAt`;
- direct received flow without tracking;
- partial physical receipt;
- partial restock;
- zero restock for damaged goods;
- identical inspection retry without duplicate inventory increment;
- conflicting inspection retry;
- inventory document missing during inspection;
- withdrawal/RMA order, customer and line mismatch;
- refund-case mismatch;
- customer account export including older RMA records;
- admin authorization and cross-origin rejection.
