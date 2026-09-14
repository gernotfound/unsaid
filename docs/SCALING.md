# UNSAID — Scaling plan

## Target envelope

The architecture is designed to grow through:

- thousands to tens of thousands of monthly visitors without a rewrite;
- bursts absorbed primarily by Vercel/CDN caching;
- thousands of public products without shipping the full catalog to the browser;
- a growing authenticated admin catalog;
- future customer accounts and orders;
- future payment/inventory integrations kept separate from editorial data.

These are design targets, not guaranteed benchmarks. Measure production before adding infrastructure.

## Current architecture

- Next.js storefront on Vercel.
- Firestore as the editorial database when `CATALOG_SOURCE=firebase`.
- Firebase Auth for admin now and customer identity later.
- Anonymous browsers do not read Firestore directly.
- Vercel reads `publicCatalog` server-side.
- Product media currently lives in the repository/Vercel asset layer.
- Commerce remains disabled.
- Catalog is a continuous archive; there is no drop/collection domain.

## Public catalog discipline

Default public page size: **24**. Maximum repository page size: **48**.

Storefront routes use cursor pagination. A browser receives one bounded page, never the entire archive.

Homepage feature/latest queries are bounded. Counters use `meta/catalog` or aggregate count fallback instead of document downloads.

## Repository boundary

Route components consume the catalog through a repository contract.

Today:

```text
Next route -> CatalogRepository -> Firestore adapter
```

A future storage change becomes:

```text
Next route -> CatalogRepository -> different adapter
```

The route/component contract remains unchanged.

## Caching

Current public pages use time-based revalidation while editorial publishing is low-frequency.

When admin publishing is moved behind server mutations, switch to targeted on-demand invalidation:

- `home`;
- `catalog`;
- `catalog:<sort>:<cursor>`;
- `product:<slug>`.

Do not cache authenticated account data, admin state, carts, checkout, orders or payment responses as public content.

## Customer accounts

Accounts do not materially change public-page scaling.

Customer identity uses Firebase Auth. Profile/address/order reads are authenticated and bounded to one customer. Orders store immutable purchase snapshots rather than joining mutable profile data during every read.

No customer field can grant admin privileges.

## Italy-only commerce

The initial market is intentionally narrow:

- shipping country: IT only;
- currency: EUR;
- authenticated customer required for checkout.

This prevents premature multi-country tax/shipping complexity. Country expansion must be an explicit product project, not a string accepted by a generic form.

## Inventory and checkout

Inventory is variant/SKU state, not catalog state.

At checkout:

1. authenticate customer;
2. validate shipping country;
3. reload sellable product and price server-side;
4. validate/reserve stock transactionally;
5. create order with immutable line/address/price snapshot;
6. create provider payment with idempotency key;
7. handle signed provider webhooks idempotently;
8. release reservations on failed/expired flows.

Do not trust price, stock, country or totals posted by the browser.

## Search

No client-side full-catalog search.

Introduce a dedicated search adapter only when relevance, latency or catalog size make search a product problem. The search index must be rebuildable from the source catalog.

## Media

Keep clean product media and editorial MODEL 01 media as distinct roles.

Move to an object-storage/CDN pipeline when one or more becomes material:

- repository/deploy size;
- responsive derivative volume;
- editorial video volume;
- media transformation cost;
- asset lifecycle requirements.

## Async worker

Use the worker boundary when operations become genuinely asynchronous:

- image generation;
- image/video transcodes;
- email delivery/retries;
- webhook retry processing;
- large bounded admin jobs.

Do not put ordinary catalog reads behind a queue.

## Operational thresholds

Add infrastructure because of measurements:

### Dedicated search
Add when search ranking/relevance/latency is commercially important.

### Object storage
Add when repository-hosted media becomes operationally expensive.

### Queue
Add when synchronous requests would otherwise wait on long-running work.

### Redis/KV
Add only for an identified ephemeral workload such as rate-limit counters or distributed locks. Do not use it as a second source of truth.

### Database migration
Consider a transactional relational store only if commerce/query requirements materially exceed a clean Firestore design. Keep repository/domain contracts provider-neutral so such a migration is bounded.

## Performance budgets

Initial expectations:

- cached public HTML is CDN-fast;
- uncached origin HTML p95 target below ~500 ms in-region where realistic;
- archive response contains one bounded page;
- product media has explicit dimensions/aspect ratio;
- no horizontal overflow at 320 px;
- public pages remain mostly Server Components;
- account/checkout JavaScript is loaded only on the routes that need it.

Measure before optimizing beyond these constraints.
