# UNSAID — Refund operations

## Safety model

A refund is split into three independent stages:

1. an admin creates a `refundCases` record from an eligible paid order;
2. a separate admin action may execute the case against Stripe only when `STRIPE_REFUNDS_ENABLED=true`;
3. provider state is reconciled from the Stripe response and signed webhook events.

Creating a case is never proof that money moved.

## Amount authority and concurrency

The browser does not submit the amount again when a case is executed. The server reads the amount already stored in the refund case and the original Stripe PaymentIntent from the payment record.

Before any external Stripe call, a Firestore transaction updates `refundControls/{orderId}`. The record tracks confirmed refunded cents and in-flight cents. A second concurrent refund cannot lock an amount that would make the cumulative total exceed the original payment.

Stripe receives a deterministic idempotency key derived from the refund-case ID.

## Provider outcomes

- `succeeded`: the in-flight amount becomes confirmed refunded;
- `pending` / `requires_action`: the amount remains in-flight and the case remains provider-created;
- `failed` / `canceled`: the in-flight amount is released and the case records the provider failure;
- transport timeout / ambiguous server error: the amount remains locked and the case enters `manual_review`.

A full cumulative refund changes the order and payment lifecycle to `refunded`. A partial refund records cumulative `refundedAmount` but does not pretend that the whole order was refunded.

Refunding money does **not** automatically put garments back into inventory. Physical restock depends on a later return/inspection decision.

## Reconciliation

`/admin/refunds` exposes `Riconcilia con Stripe` for `manual_review` and provider-created cases.

If the case already has a Stripe refund ID, reconciliation retrieves that exact refund from Stripe.

If a network failure happened before the Stripe refund ID was received, reconciliation replays the original create-refund request with the **same deterministic Stripe idempotency key and the same server-authoritative amount/PaymentIntent**. It does not generate a new refund request identity.

The returned amount and PaymentIntent are checked against internal state before the provider result is applied.

If reconciliation is still ambiguous, the amount stays locked. Operators must not create a separate refund case as a workaround.

## Webhooks

The existing signed Stripe webhook endpoint also processes `refund.updated` and `refund.failed`. Refund webhook events use the same `webhookEvents/{eventId}` deduplication ledger as payment events.

Provider metadata must link the refund to both `refund_case_id` and `order_id`. Unmatched external/dashboard refunds are not silently attached to an order and require manual reconciliation.

## Before enabling live refunds

Keep `STRIPE_REFUNDS_ENABLED=false` until Stripe test mode has covered:

- full refund;
- partial refund;
- two concurrent partial refunds;
- duplicate admin click;
- Stripe 4xx rejection;
- network timeout followed by reconciliation;
- provider-created/pending refund followed by webhook success;
- failed refund webhook;
- full cumulative refund changing the order to `refunded` exactly once.

The refund workflow is financial state. When provider and internal state disagree, preserve the lock and investigate rather than guessing.
