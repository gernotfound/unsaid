# UNSAID — Payments

## Provider boundary

Phase-one payments use **Stripe hosted Checkout** through a server-side adapter. The storefront never receives the Stripe secret key and never marks an order paid from a browser redirect.

The provider integration deliberately uses the Stripe REST API directly from the server so the existing dependency lockfile remains unchanged. Requests pin an explicit Stripe API version; changing that version is a migration decision, not an automatic upgrade.

## Feature gates

Payments remain fail-closed until all upstream gates are ready:

- customer accounts enabled;
- public shop enabled;
- legal commerce identity ready;
- pre-payment checkout configuration ready;
- Stripe payment gate explicitly enabled;
- canonical public site URL configured;
- Stripe secret key configured;
- Stripe webhook signing secret configured.

Relevant environment names:

```text
STRIPE_PAYMENTS_ENABLED
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CHECKOUT_SESSION_MINUTES
STRIPE_API_VERSION
NEXT_PUBLIC_SITE_URL
```

`STRIPE_CHECKOUT_SESSION_MINUTES` is constrained to 30–120 minutes. Stripe currently requires Checkout Session expiration to be between 30 minutes and 24 hours; UNSAID keeps a deliberately narrower upper bound.

## Create-payment flow

1. customer has an authenticated, non-revoked, email-verified server session;
2. a previously prepared `pending_payment` order already exists;
3. the server transaction verifies the order belongs to the customer;
4. active stock reservations are rechecked;
5. a `paymentSessionIntents/{orderId}` lock is created before the external Stripe request;
6. reservation/checkout-attempt expiry is extended to the provider session window plus a short webhook grace period;
7. the server creates the hosted Stripe Checkout Session using authoritative order snapshots;
8. the Stripe session ID + Checkout URL are attached to the payment intent;
9. the browser is redirected to Stripe.

A repeated request for the same order reuses an already-created open Checkout Session rather than creating a second payment session.

## Amount authority

Stripe line items are generated exclusively from the immutable order snapshot:

- SKU/title/size;
- unit amount;
- quantity;
- shipping amount.

The browser cannot submit or override the payment amount.

The Stripe webhook must also report exactly the expected EUR gross total before stock is committed.

## Webhook boundary

Endpoint:

```text
POST /api/payments/stripe/webhook
```

The route reads the **raw request body**, validates the `Stripe-Signature` HMAC with constant-time comparison, enforces timestamp tolerance and only then parses/processes the event.

Handled lifecycle events:

- `checkout.session.completed` when `payment_status=paid`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.expired`;
- `checkout.session.async_payment_failed`.

The phase-one hosted session currently requests card payment methods only, so async methods are not expected in normal operation; the handlers are still defensive.

## Paid transaction

A valid paid webhook executes one Firestore transaction that:

- deduplicates the Stripe event in `webhookEvents/{eventId}`;
- verifies the Stripe Checkout Session matches the server-created payment intent;
- verifies currency and gross amount;
- verifies each inventory reservation still exists and matches the order line;
- decrements `onHand`;
- decrements `reserved`;
- marks each reservation `committed`;
- marks the order `paid`;
- marks the payment-session intent `paid`;
- records the provider payment/session IDs;
- marks the checkout attempt `paid`.

The same webhook can be retried without decrementing inventory twice.

## Manual review safety state

If Stripe says money is paid but the internal amount/session/reservation/inventory state does not match expectations, UNSAID **does not guess and does not release stock automatically**.

Instead:

- the payment intent becomes `manual_review`;
- the payment record becomes `manual_review`;
- the checkout attempt becomes `payment_review` so the expiry sweeper does not release the reservation;
- the order receives a server-only review marker;
- an operator must reconcile payment, stock and refund/fulfillment state.

This state is intentionally safer than silently treating a paid-but-inconsistent event as failed.

## Expiration / failed payment

On a valid Stripe expiry/failure event, active reservations are transactionally released and the pending order becomes `cancelled`.

Customer cancellation is blocked while a Stripe payment session is `creating`, `ready`, `paid` or `manual_review`, preventing a race in which the browser could free stock while a provider payment is in flight.

The ordinary checkout expiry sweeper is payment-session aware and only releases an expired provider hold after its server-side hold window has elapsed.

## Operational launch checklist

Before enabling real payments:

- configure Stripe in **test mode** first;
- register the production webhook URL;
- subscribe to the handled Checkout Session events;
- verify the webhook signing secret in the deployment environment;
- verify the canonical `NEXT_PUBLIC_SITE_URL` uses the final HTTPS domain;
- test successful card payment, declined card, abandoned/expired session, duplicate webhook delivery and concurrent cancellation attempts;
- test that stock is committed exactly once on success and released on expiration;
- confirm shipping/VAT/legal configuration separately;
- define the refund and fulfillment operating procedure before switching to live Stripe keys.
