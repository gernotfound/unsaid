# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID statement-wear archive and future Italy-only shop.

## Repository

- `apps/web` — Next.js storefront and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — stable business contracts and policies
- `packages/db` — Firebase Admin / Firestore adapter and seed tooling
- `packages/catalog` — catalog contracts and local fallback source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog snapshot / bootstrap seed
- `docs` — architecture, scaling, accounts, commerce, legal/privacy, operations and security
- `DESIGN.md` — authoritative visual contract

## Locked product decisions

- Fashion Fluo dark-first storefront.
- One continuous archive; no drops/collections for now.
- Phase-one garments: white and black.
- Customer accounts will be required to purchase.
- Initial commerce market: Italy only.
- Currency: EUR.
- Shop remains disabled until implementation and legal readiness are complete.

## Architecture

UNSAID is a modular monolith.

Current production path:

```text
Browser
  -> Vercel CDN
  -> Next.js
      -> CatalogRepository
          -> Firestore adapter
      -> Firebase Auth
      -> static media / future object CDN
```

Firestore is the current editorial database, not a UI dependency. Storefront route components consume a repository contract so a future storage migration does not require rewriting the product experience.

See `docs/ARCHITECTURE.md` and `docs/SCALING.md`.

## Catalog

A T-shirt is one canonical `catalog/{id}` editorial document. Published records are projected to `publicCatalog/{id}` without internal notes/revision metadata.

Public lists are bounded and cursor-paginated. Anonymous browsers never read Firestore directly and never receive the entire catalog for ordinary rendering.

The archive is continuous. Product identity does not depend on a drop or collection.

## Accounts

Browsing remains anonymous.

Before commerce opens, customer accounts will use Firebase Authentication and a separate customer profile/address domain. Checkout requires a server-verified customer session.

See `docs/ACCOUNTS.md`.

## Commerce

Editorial and commercial state are separate.

Future commerce uses:

```text
CatalogRecord
  -> SellableProduct
      -> SellableVariant / SKU
          -> Inventory

Customer -> Order -> Payment -> Shipment
```

Italy is the only shipping market at first launch. Browser-submitted price, stock, country and totals are never authoritative.

See `docs/COMMERCE.md`.

The shop remains intentionally off:

```env
NEXT_PUBLIC_SHOP_ENABLED=false
LEGAL_COMMERCE_READY=false
```

Both gates must be ready before the application considers commerce active.

## Privacy / legal

The public site includes:

- `/privacy`;
- `/cookies`;
- `/legal`;
- `/terms`.

Analytics is privacy-by-default and remains off until explicit consent and minimum legal identity configuration are present.

See `docs/LEGAL.md`.

## MODEL 01

MODEL 01 is a stable brand asset, not a different generated robot per image. Media contracts distinguish clean product media from editorial/model/campaign/video roles.

See `DESIGN.md` and the domain media contract.

## Dependency reproducibility

Third-party versions are centrally pinned in `pnpm-workspace.yaml` and consumed through the `catalog:` protocol. Internal packages use `workspace:` references.

The repository rejects `latest`/wildcard dependency drift.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Validate:

```bash
pnpm check:dependencies
pnpm seed:firestore:check
pnpm test
pnpm typecheck
pnpm build
```

Trusted server-side initial seed:

```bash
pnpm seed:firestore
```

## Deployment

Production target: Vercel.

`main` is production. Prefer validating a complete batch on a candidate branch and moving `main` once after CI succeeds.

See `docs/OPERATIONS.md`.
