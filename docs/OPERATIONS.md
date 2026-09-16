# Operations / release discipline

## Main branch

`main` is the production branch.

Current project mode: development work may be committed directly to `main` while the Vercel production deploy is explicitly paused. Each commit still triggers CI and must keep the branch recoverable. Before production deploy is resumed, require a fully green `main`, review the final environment configuration and perform a production smoke test.

When production deploy automation is active again, prefer a validated batch/candidate workflow if intermediate commits could expose incomplete behavior.

## CI contract

Every committed state intended to remain on `main` must pass:

1. deterministic dependency install;
2. dependency-policy check;
3. catalog validation;
4. unit tests;
5. TypeScript typecheck;
6. Next.js production build.

A lockfile is mandatory. CI uses `--frozen-lockfile`.

## Dependency policy

Workspace manifests may use only:

- exact versions;
- `catalog:` for centrally pinned third-party versions;
- `workspace:` for internal packages.

Do not use `latest`, wildcard third-party versions or unbounded ranges in production manifests.

The central dependency catalog lives in `pnpm-workspace.yaml`.

## Release checklist

Before production deployment is resumed:

- latest `main` CI is green;
- no secrets are committed;
- legal/commerce/account/payment gates remain correct;
- schema/data migrations are backwards-safe;
- Stripe webhook and canonical site URL are configured in the target environment;
- shipping/VAT configuration has been reviewed;
- cache behavior is understood;
- a rollback commit/ref is known;
- order/payment/refund operational procedures are documented and tested.

## Admin order operations

`/admin/orders` is the operational read/control surface for orders, payment state, reservations and refund cases.

Rules:

- `manual_review` is a stop state: do not fulfill, retry payment or release stock by assumption;
- `paid -> processing` is allowed only when the server-side payment record is also `paid`;
- cancelling `pending_payment` uses the payment-session guard and must not race an active Stripe session;
- creating a `refundCase` records an operator request only; it does **not** send money to Stripe;
- a provider refund adapter must be added and tested before any refund case can become `processed`;
- customer/order/payment documents remain server-only even for admins using the web console.

## Cache invalidation

Public catalog/home/product pages may be cached.

Server-side commerce/publish operations should invalidate only the affected routes/tags rather than forcing global cache purges.

Private routes are never public-cache candidates:

- admin;
- account;
- cart;
- checkout;
- orders;
- payment callbacks.

## Observability

Structured logs should use stable event names and context fields such as:

- `requestId`;
- `route`;
- `userId`;
- `orderId`.

Never log secrets or raw personal/payment payloads.

Connect the provider-neutral logging/error boundary to production monitoring before commerce launch.

## Incident priorities

For a storefront incident:

1. disable commerce if order/payment correctness is uncertain;
2. preserve public archive availability where safe;
3. inspect structured errors/runtime logs;
4. roll back to last known-good commit if needed;
5. reconcile payment/inventory state before reopening checkout.

Payment correctness is more important than checkout availability.
