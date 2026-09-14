# UNSAID

> **wear what you wouldn't say.**

TypeScript monorepo for the UNSAID statement-wear archive and future Italy-only shop.

## Repository

- `apps/web` — Next.js storefront, customer account area and control room
- `apps/worker` — asynchronous render/image/email boundary
- `packages/domain` — stable business contracts and policies
- `packages/db` — Firebase Admin / Firestore adapters, customer/commerce repositories and seed tooling
- `packages/catalog` — catalog contracts and local fallback source
- `packages/ui` — shared UI boundary
- `data/catalog/archive.json` — versioned catalog snapshot / bootstrap seed
- `docs` — architecture, scaling, accounts, commerce, legal/privacy, operations and security
- `DESIGN.md` — authoritative visual contract

## Locked product decisions

- Fashion Fluo dark-first storefront.
- One continuous archive; no drops/collections for now.
- Phase-one garments: white and black.
- Customer account required to purchase.
- Verified email required before checkout.
- Initial commerce market: Italy only.
- Currency: EUR.
- Shop remains disabled until payment, operating process and legal readiness are complete.

## Architecture

UNSAID is a modular monolith.

Current production path:

```text
Browser
  -> Vercel CDN
  -> Next.js
      -> CatalogRepository -> Firestore
      -> Customer session APIs -> Firebase Auth + Firestore customer data
      -> Commerce repositories -> Firestore server-only collections
      -> static media / future object CDN
```

Firestore is the current application/editorial database, not a public storefront dependency. Anonymous catalog delivery and customer-sensitive data are mediated by Next.js/Firebase Admin.

See `docs/ARCHITECTURE.md` and `docs/SCALING.md`.

## Catalog

A T-shirt is one canonical `catalog/{id}` editorial document. Published records are projected to `publicCatalog/{id}` without internal notes/revision metadata.

Public lists are bounded and cursor-paginated. Anonymous browsers never read Firestore directly and never receive the entire catalog for ordinary rendering.

The archive is continuous. Product identity does not depend on a drop or collection.

## Accounts

Browsing remains anonymous. `/account` contains the customer identity area.

Implemented foundations include Firebase email/password registration and login, email verification, password reset, an HttpOnly server session, customer profile, Italy-only saved addresses and customer-scoped order-history reads.

Registration is intentionally gated:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=false
```

The account feature also requires the minimum configured privacy identity. Checkout policy requires an authenticated server session and verified email.

See `docs/ACCOUNTS.md`.

## Commerce

Editorial and commercial state are separate:

```text
CatalogRecord
  -> SellableProduct
      -> SellableVariant / SKU
          -> Inventory
             -> InventoryReservation

Customer -> Order -> Payment -> Shipment
```

`/admin/commerce` is the commercial control room. It configures sale activation, EUR price, white/black garment color, deterministic XS–XXL SKUs and per-size on-hand stock without changing the editorial revision.

Commerce writes are server-mediated and admin-authorized. Browser Firestore access to sellable products, variants, inventory and orders remains denied. Administrative stock updates preserve reserved quantities and cannot push `onHand` below `reserved`.

Firestore repositories now exist for sellable products, variants, transactional inventory reservation and orders. Payment/checkout remains deliberately unwired.

Italy is the only shipping market at first launch. Browser-submitted price, stock, country and totals are never authoritative.

See `docs/COMMERCE.md`.

The shop remains intentionally off:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=false
NEXT_PUBLIC_SHOP_ENABLED=false
LEGAL_COMMERCE_READY=false
```

Account/privacy readiness is also part of the commerce gate.

## Privacy / legal

The public site includes:

- `/privacy`;
- `/cookies`;
- `/legal`;
- `/terms`.

Analytics is privacy-by-default and remains off until explicit consent and minimum legal identity configuration are present. Customer registration is separately gated until privacy identity is configured.

See `docs/LEGAL.md`.

## MODEL 01

MODEL 01 is a stable brand asset, not a different generated robot per image. Media contracts distinguish clean product media from editorial/model/campaign/video roles.

See `DESIGN.md` and the domain media contract.

## Dependency reproducibility

Third-party versions are centrally pinned in `pnpm-workspace.yaml` and consumed through the `catalog:` protocol. Internal packages use `workspace:` references.

The repository rejects `latest`/wildcard dependency drift and CI installs with a frozen lockfile.

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
