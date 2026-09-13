# Scaling plan

## Target envelope
- 10k–100k monthly visitors without architectural change.
- Bursts of thousands of simultaneous page views, primarily served by CDN/cache.
- 10k+ products without shipping the catalog to the browser.
- Hundreds of render/image jobs without blocking user requests.

These are design envelopes, not guaranteed benchmarks; load-test against the actual hosting plan and media sizes.

## Phase 1
- Stateless Next.js instances.
- Pooled PostgreSQL.
- CDN cache for public pages.
- Object storage for media.
- Cursor pagination, 24–48 products/page.
- PostgreSQL FTS/trigram search.
- Rate limits on auth/search/checkout/admin.

## Phase 2 — only when metrics justify it
- Read replica after cache hit rate is optimized.
- Dedicated search only when PostgreSQL search p95/ranking becomes insufficient.
- Separate queue concurrency for generation/transcode/email.
- Precompute media derivatives on ingestion.

## Phase 3
Only at genuinely high load, split catalog/search, commerce and render orchestration into independently deployed services while preserving TypeScript domain contracts.

## Performance budgets
- Origin storefront HTML p95 target < 500 ms in-region; cached should be much faster.
- Common search p95 target < 300 ms.
- Minimal client JS on product pages.
- Responsive AVIF/WebP, lazy loading below fold.
