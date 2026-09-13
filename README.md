# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID editorial streetwear archive.

## Repository

- `apps/web` — Next.js storefront and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — brand and business contracts
- `packages/db` — Firebase Admin / Firestore adapter and seed tooling
- `packages/catalog` — catalog contracts and local fallback source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog source
- `docs` — architecture, admin, scaling, render and security decisions
- `DESIGN.md` — authoritative visual contract

## Current archive state

The previous 81-record archive was test data and has been removed. The repository starts from the real UNSAID catalog only; placeholder records are not restored.

## Storefront status

The web app includes:

- branded editorial homepage;
- `/shop` as the public archive while commerce is disabled;
- responsive phone/tablet/landscape layouts;
- search, filters, sorting and 18+ controls;
- product detail routes resolved by Next.js at runtime;
- Firebase Analytics behind explicit consent;
- `/admin/` control room with Firebase Authentication and Firestore;
- local catalog fallback through `CATALOG_SOURCE=local`;
- branded 404, legal drafts, metadata and favicon;
- GitHub Actions CI for validation/build only.

The shop remains intentionally **off**:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
```

## Firebase

Project: `unsaid-54c7e`, Firestore Standard in `europe-west8`.

The admin authenticates through Firebase Email/Password. Public storefront reads can move to Firebase Admin server-side by setting `CATALOG_SOURCE=firebase` once the server credentials are configured in Vercel.

Server-only credentials never use the `NEXT_PUBLIC_` prefix and must never be committed.

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

## Deployment

Production target: **Vercel**.

The app now uses native Next.js deployment: no static export, no repository `basePath`, no GitHub Pages workflow and no Pages-specific asset rewriting. Home, archive and product pages use a short revalidation window so a Firestore-backed catalog can update without requiring a deployment for every editorial change.

The repository may be private; the Vercel Git integration simply needs permission to access it.
