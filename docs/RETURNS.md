# UNSAID — Returns / RMA

## Scope

The return workflow is separate from fulfillment and refund execution.

```text
customer request -> approval -> inbound transit -> received -> inspected -> closed
```

A physical return is **not** proof that money was refunded. A refund is **not** proof that a garment is physically back in sellable inventory.

## Feature gates

Customer return requests stay fail-closed until both server-side gates are enabled:

```text
RETURNS_ENABLED=true
RETURNS_POLICY_READY=true
```

`RETURNS_POLICY_READY` must remain false until the published return/withdrawal policy and its legal/business rules have been reviewed. The implementation deliberately does not hard-code a statutory request window or shipping-refund entitlement while those rules are unresolved.

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

- `requested` — customer request recorded;
- `approved` — operator accepted the RMA;
- `rejected` — operator rejected the request;
- `in_transit` — return shipment is on the way back, optionally with carrier/tracking metadata;
- `received` — parcel physically received;
- `inspected` — received quantities and restock quantities were recorded;
- `closed` — RMA operationally closed.

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

A garment that was refunded but not physically received/approved for resale never returns to stock automatically.

## Refund linkage

After inspection an RMA can link to an existing `refundCases/{refundCaseId}` record. The server verifies that return and refund refer to the same order and customer.

The RMA layer does not decide the refund amount, shipping reimbursement or legal entitlement. Those remain in the refund/legal policy layer. This avoids encoding an unreviewed return policy into inventory logic.

## Data export and privacy

Customer account export includes RMA records linked to the customer's orders.

Return records can contain reason text and operational shipment metadata. Keep free-text notes bounded and do not use the RMA record for unnecessary sensitive information.

## Pre-launch validation

Before enabling public return intake, test at minimum:

- delivered-order request;
- rejection of shipped/processing orders;
- quantity greater than purchased;
- duplicate request retry;
- conflicting second request for the same order;
- approval and inbound tracking;
- direct received flow without tracking;
- partial physical receipt;
- partial restock;
- zero restock for damaged goods;
- inventory document missing during inspection;
- refund-case mismatch;
- customer account export;
- admin authorization and cross-origin rejection.
