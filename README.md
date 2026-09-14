# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID statement-wear archive and future shop.

## Repository

- `apps/web` — Next.js storefront and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — brand and commerce contracts
- `packages/db` — Firebase Admin / Firestore adapter and seed tooling
- `packages/catalog` — catalog contracts and local fallback source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog snapshot / bootstrap seed
- `docs` — architecture, scaling, admin and security decisions
- `DESIGN.md` — authoritative visual contract

## Brand direction

The storefront uses the **Fashion Fluo** system documented in `DESIGN.md`: dark-first UI, permanent pink/cyan/violet/amber/orange signal colors, monochrome garments and one recurring humanoid fashion model (`UNSAID MODEL 01`).

Current catalog images/copy are working content while the real garment/artwork library is built.

## Catalog architecture

A T-shirt is one canonical `catalog/{id}` Firestore document. Published records are projected to `publicCatalog/{id}` without internal notes or revision metadata. IDs are allocated transactionally and are never reused. Slugs have their own uniqueness/tombstone collection and every save increments a revision so stale admin sessions cannot silently overwrite newer work.

The checked-in JSON is a bootstrap/fallback snapshot, not a second editorial database. When Vercel has Firebase Admin credentials and `CATALOG_SOURCE=firebase`, the storefront reads the published projection server-side.

## Storefront

The public app includes:

- a dark Fashion Fluo homepage;
- `/shop` as a server-rendered, cursor-paginated archive;
- product pages with independent front/back views;
- a canonical MODEL 01 editorial language;
- responsive phone/tablet/landscape layouts;
- Firebase Analytics behind explicit consent;
- `/admin/` as a separate dark technical control room.

The storefront no longer downloads the complete public catalog into the browser for ordinary archive rendering. Pagination and sorting are resolved server-side.

The shop remains intentionally off:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
```

## Firebase

Project: `unsaid-54c7e`, Firestore Standard in `europe-west8`.

The admin authenticates through Firebase Email/Password. Browser Firestore access is limited to the owner/admin allowlist. Anonymous storefront traffic does not read Firestore directly; Vercel reads `publicCatalog` through Firebase Admin.

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

## Scaling

See `docs/SCALING.md`.

The key rule is simple: no ordinary public route should require sending the full catalog to the browser. Storefront lists use bounded server-side reads and cursor pagination; dedicated full-text search/media infrastructure is introduced only when the real catalog and metrics require it.

## Deployment

Production target: **Vercel** — `https://unsaid-gnf.vercel.app/`.

The repository uses native Next.js deployment: no static export, GitHub Pages workflow or repository base path. Storefront pages use a five-minute revalidation window during this phase.

The repository can remain private as long as the Vercel Git integration retains access.
