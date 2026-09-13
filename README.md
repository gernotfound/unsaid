# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID editorial streetwear archive.

## Repository

- `apps/web` — Next.js storefront and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — brand and business contracts
- `packages/db` — Firebase Admin / Firestore adapter and seed tooling
- `packages/catalog` — catalog contracts and local static source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog source
- `docs` — architecture, admin, scaling, render and security decisions
- `DESIGN.md` — authoritative visual contract

## Current archive state

The previous 81-record archive was test data and has been removed. The repository now starts from an intentionally empty `data/catalog/archive.json` and will be populated only with the real UNSAID phrases.

The public archive therefore currently renders an intentional empty state rather than placeholder products.

## Storefront status

The web app includes:

- branded editorial homepage;
- `/shop` as the public archive while commerce is disabled;
- responsive phone/tablet/landscape layouts;
- search, filters, sorting and 18+ controls once records exist;
- product detail routes generated from the current public archive;
- Firebase Analytics behind explicit consent;
- `/admin/` control room prepared for Firebase Authentication and Firestore;
- local catalog fallback through `CATALOG_SOURCE=local`;
- branded 404, draft legal pages, metadata and favicon;
- GitHub Actions CI and GitHub Pages deployment.

The shop remains intentionally **off**:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
CATALOG_SOURCE=local
```

## Firebase

Project: `unsaid-54c7e`, Firestore Standard in `europe-west8`.

Direct browser Firestore access remains deny-all until the owner Authentication UID is explicitly authorized. Server-only credentials never use the `NEXT_PUBLIC_` prefix.

The control room can authenticate first and show the account UID while Firestore is still locked. That is the intended bootstrap sequence.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Catalog seed validation:

```bash
pnpm --filter @unsaid/db seed:catalog
```

The seed command refuses to write when the archive is empty.

## Temporary deployment

The current public site is built as a static export and deployed with GitHub Pages. This temporary deployment deliberately keeps the catalog local and commerce disabled.

A server deployment will be reintroduced later for cached Firestore-backed public reads and commerce. Vercel is not part of the current working loop.
