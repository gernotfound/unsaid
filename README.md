# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID editorial streetwear archive.

## Repository

- `apps/web` — Next.js storefront and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — brand and commerce contracts
- `packages/db` — Firebase Admin / Firestore adapter and seed tooling
- `packages/catalog` — catalog contracts and local fallback source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog snapshot / bootstrap seed
- `docs` — architecture, admin and security decisions
- `DESIGN.md` — visual contract

## Catalog architecture

The old test archive is gone. The catalog contains only real UNSAID records.

A T-shirt is one canonical `catalog/{id}` Firestore document. Published records are projected to `publicCatalog/{id}` without internal notes or revision metadata. IDs are allocated transactionally and are never reused. Slugs have their own uniqueness/tombstone collection and every save increments a revision so stale admin sessions cannot silently overwrite newer work.

The checked-in JSON is a bootstrap/fallback snapshot, not a second editorial database. Once Vercel has Firebase Admin credentials, set `CATALOG_SOURCE=firebase` and the storefront reads the published projection server-side.

## Storefront

The web app includes a branded homepage, `/shop` archive search/filtering, product pages with independent front/back views, responsive layouts, Firebase Analytics behind consent, and `/admin/` with Firebase Authentication + Firestore.

The shop remains intentionally off:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
```

## Firebase

Project: `unsaid-54c7e`, Firestore Standard in `europe-west8`.

The admin authenticates through Firebase Email/Password. Browser Firestore access is limited to the owner/admin allowlist. Anonymous storefront traffic does not read Firestore directly; when `CATALOG_SOURCE=firebase`, Vercel reads `publicCatalog` through Firebase Admin.

Server-only credentials never use the `NEXT_PUBLIC_` prefix and must never be committed.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Validate the versioned catalog without writing to Firebase:

```bash
pnpm seed:firestore:check
```

Trusted server-side initial seed:

```bash
pnpm seed:firestore
```

## Deployment

Production target: **Vercel** — `https://unsaid-gnf.vercel.app/`.

The repository uses native Next.js deployment: no static export, GitHub Pages workflow or repository base path. Storefront pages use a five-minute revalidation window to keep Firestore reads bounded when the remote source is enabled.

The repository can remain private as long as the Vercel Git integration retains access.
