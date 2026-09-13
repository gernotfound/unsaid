# UNSAID

> **wear what you wouldn't say.**

Production-oriented TypeScript monorepo for the UNSAID streetwear catalog.

## What is in this repository

- `apps/web` — Next.js storefront/application source of truth
- `apps/worker` — asynchronous render/image/email job boundary
- `packages/domain` — brand and business contracts
- `packages/db` — Firebase Admin / Firestore data adapter
- `packages/catalog` — catalog/search contracts and local archive fallback
- `packages/ui` — shared UI package boundary
- `data/catalog` — complete creative archive, versioned as migration/seed data
- `apps/web/public/products/UNS-0001` — approved FRONTE / RETRO front/back assets
- `docs` — architecture, scaling, brand, data model, render pipeline and security decisions
- `DESIGN.md` — authoritative visual contract

## Brand

**UNSAID**  
*wear what you wouldn't say.*

Public product IDs use `UNS-xxxx`. Historical prototype IDs are retained as `legacyId` only in migration data.

## Storefront status

The Next.js app includes:

- branded editorial homepage;
- `/shop` used as the public archive while commerce is disabled;
- live search, category filters, sorting and an explicit 18+ visibility control;
- progressive catalog rendering;
- `/product/[slug]` routes for every public archive record;
- approved front/back gallery for `UNS-0001`;
- size controls and client cart logic already implemented but gated by `NEXT_PUBLIC_SHOP_ENABLED`;
- Firebase/Firestore adapter with safe local JSON fallback via `CATALOG_SOURCE`;
- branded 404, draft legal pages, metadata and favicon;
- GitHub Actions CI for install, typecheck and production build.

The shop is intentionally **off** by default. Keep:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
CATALOG_SOURCE=local
```

When Firebase is configured, set the server-only Firebase Admin variables from `.env.example` and change `CATALOG_SOURCE=firebase`.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

For Firestore development you can use the Firebase Emulator Suite with the checked-in `firebase.json` and `firestore.rules`.

## Deployment

Target platform: **Vercel**. The web app is Next.js and the database is Firebase/Firestore. Secrets belong in Vercel environment variables and are never committed.

The intended deployment model is GitHub → Vercel, with preview deployments for branches/PRs and production from `main`.

## Current status

The visual storefront, archive navigation, Firebase data boundary and future commerce controls are in place. Payments, authentication and checkout remain intentionally disabled.
