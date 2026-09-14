# Scaling plan

## Target envelope

The architecture should comfortably support the next growth stages without a rewrite:

- thousands to tens of thousands of monthly visitors;
- bursts primarily absorbed by Vercel/CDN caching;
- thousands of public products without shipping the entire catalog to the browser;
- a growing admin catalog with cursor pagination;
- future commerce, inventory and orders without coupling them to editorial records.

These are design targets, not guaranteed benchmarks. Production performance must be measured on the actual Vercel/Firebase plans.

## Current architecture

- Next.js storefront on Vercel.
- Firestore as the editorial database when `CATALOG_SOURCE=firebase`.
- Anonymous browsers do not read Firestore directly.
- Vercel reads `publicCatalog` server-side with Firebase Admin.
- Public product media currently lives in the repository/Vercel asset layer.
- Firebase Storage and Cloud Functions are intentionally not required in this phase.
- Commerce remains disabled and separate from editorial publishing.

## Public catalog rules

### Never full-scan for ordinary storefront rendering

The archive is paginated server-side with a numeric sequence cursor. A browser should receive one page of products, not the full catalog.

Default public page size: **24**.

The homepage uses a dedicated bounded query for the featured/latest product instead of loading the full catalog and searching in application memory.

### Sorting

Sorting by archive sequence happens in Firestore/local repository adapters, not after transferring all records to the client.

### Search

Do not implement "search" by downloading the whole catalog into React.

When full-text search becomes necessary, use one of these bounded strategies:

1. a deliberately maintained Firestore search projection suitable for the query shape; or
2. a dedicated search service (for example Algolia, Typesense or Meilisearch) behind the catalog/search interface.

The UI should not be coupled to the eventual search provider.

## Caching

Storefront routes use short revalidation windows during this phase. This keeps origin reads bounded while allowing editorial changes to become visible without a deploy.

As publishing frequency grows, replace broad time-based refreshes with on-demand revalidation triggered by an authorized publish operation.

Recommended public strategy:

- home: cached/revalidated;
- archive pages: cached per cursor/sort URL where appropriate;
- product pages: cached/revalidated by slug;
- checkout/cart (future): dynamic and never cached as public content.

## Firestore read discipline

- Prefer `meta/catalog` for counters rather than counting/scanning documents on every request.
- If aggregate metadata is missing, use Firestore aggregate count operations rather than downloading all public documents.
- Keep browser reads to `publicCatalog` closed; public delivery remains server-side.
- Use cursor pagination for admin and storefront lists.
- Add composite indexes only when a real query requires them; do not accumulate speculative indexes.

## Media scaling

Current repository-hosted product images are appropriate for the present catalog and keep the project compatible with the Firebase Spark constraints.

Before media volume becomes large:

- establish a canonical garment base;
- maintain front/back clean renders separately from editorial MODEL 01 media;
- generate responsive derivatives;
- move high-volume media to a deliberate object-storage/CDN solution only when usage justifies it.

Do not make Firebase Storage a hidden requirement without an explicit plan change.

## Client JavaScript budget

Use Server Components by default.

Client JavaScript is reserved for:

- front/back gallery interaction;
- consent/preferences;
- commerce interactions when enabled;
- authenticated admin tools.

Catalog grids, product metadata and ordinary navigation do not need to be hydrated client applications.

## Commerce boundary

Editorial records and physical commerce records must remain separate.

Future domains:

- editorial product / artwork;
- sellable product;
- variant/SKU;
- inventory;
- cart;
- order;
- payment state;
- fulfillment.

A change to stock or price must not rewrite the creative/editorial identity of a shirt.

## Admin scaling

The control room should continue to use:

- cursor pagination;
- indexed search/query patterns;
- optimistic concurrency through `revision`;
- permanent IDs and slug tombstones;
- explicit lifecycle state.

When bulk operations are introduced, use bounded batches and clear progress/error reporting rather than thousands of browser-side writes at once.

## Operational thresholds

Introduce additional infrastructure only when measurements justify it.

### Add dedicated search when

- search relevance matters commercially;
- catalog size/query patterns exceed a clean Firestore projection;
- search latency or ranking becomes a product problem.

### Add a media/object pipeline when

- repository size/deploy time becomes material;
- many responsive derivatives are required;
- editorial video/image volume grows significantly.

### Add queues/workers when

- rendering, email or media processing becomes asynchronous production work;
- user requests would otherwise wait for long-running jobs.

### Split services only when

catalog/search, commerce or render orchestration have genuinely different scaling/deployment needs. Preserve shared TypeScript contracts so a later split does not require rewriting the product model.

## Performance budgets

Initial budgets:

- cached public HTML should normally be CDN-fast;
- uncached origin HTML p95 target: < 500 ms in-region where realistic;
- public archive payload: one bounded page, never the full catalog;
- LCP asset should be deliberately sized and compressed;
- avoid layout shift in product media;
- no horizontal overflow at 320 px;
- keep product pages mostly server-rendered.

Measure before optimizing beyond these constraints.
