# Operations / release discipline

## Main branch

`main` is the production branch.

Prefer one validated batch update over chains of small production pushes. Build/test work should happen on a candidate branch, then `main` moves once after validation.

## CI contract

Every candidate must pass:

1. deterministic dependency install;
2. dependency-policy check;
3. catalog validation;
4. unit tests;
5. TypeScript typecheck;
6. Next.js production build.

A lockfile is mandatory. CI uses `--frozen-lockfile` once the lockfile is committed.

## Dependency policy

Workspace manifests may use only:

- exact versions;
- `catalog:` for centrally pinned third-party versions;
- `workspace:` for internal packages.

Do not use `latest`, wildcard third-party versions or unbounded ranges in production manifests.

The central dependency catalog lives in `pnpm-workspace.yaml`.

## Release checklist

Before moving `main`:

- candidate branch is based on current `main`;
- CI is green;
- no secrets in diff;
- legal/commerce gates remain correct;
- schema/data migrations are backwards-safe;
- cache behavior is understood;
- a rollback commit/ref is known.

## Cache invalidation

Public catalog/home/product pages may be cached.

Future server-side publish operations should invalidate only the affected tags rather than forcing global cache purges.

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
