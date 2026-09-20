# Operations / release discipline

## Main branch

`main` is the production branch and is never a development workspace.

All code, configuration and documentation changes must start from the current SHA of `main` on a dedicated branch. Do not commit directly to `main`, do not force-update it and do not use it for intermediate fixes. Validate the branch first, open a pull request against `main`, then merge the completed change. A corrective follow-up for a just-merged change must also use a new branch.

Before creating a work branch, re-read the current `main` SHA so work never starts from a stale base. Prefer one coherent final commit per work block when practical; avoid chains of incidental microcommits.

Vercel Git deployments from non-`main` branches must remain disabled. Branch validation uses GitHub CI; merging to `main` must not be used as a substitute for validating the branch first.

Before production deploy is resumed or relied upon, require a fully green `main`, review the final environment configuration and perform a production smoke test.

## CI contract

Every branch intended to merge into `main` must pass:

1. deterministic dependency install;
2. dependency-policy check;
3. catalog validation;
4. unit tests;
5. TypeScript typecheck;
6. Next.js production build.

A lockfile is mandatory. CI uses `--frozen-lockfile`.

If GitHub Actions fails before a runner is assigned (`runner_id = 0`, no steps/logs), treat that as an infrastructure/account/runner failure until proven otherwise. Do not change application code merely to make such a run appear green.

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
- Stripe refund execution remains separately gated by `STRIPE_REFUNDS_ENABLED` and must stay disabled until the refund test matrix and operating procedure are complete;
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
