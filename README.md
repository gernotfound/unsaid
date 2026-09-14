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
- Shop/payment remains disabled until operating process and legal readiness are complete.

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

`/admin/commerce` configures sale activation, EUR price, white/black garment color, deterministic XS–XXL SKUs and per-size on-hand stock without changing the editorial revision.

Public product/archive pages resolve sale price and availability from the server-side commerce projection. `/cart` stores only non-authoritative variant IDs and quantities and calls `/api/cart/validate` for current product, price and stock.

`/checkout` now implements the pre-payment trust boundary. With all gates explicitly enabled it requires a verified customer account and customer-owned Italian address, then revalidates commerce data and creates one idempotent `pending_payment` order while reserving all SKU quantities inside the same Firestore transaction. Customer cancellation releases the reservation transactionally.

Shipping and VAT are fail-closed configuration; there is no hard-coded business rate. Pending reservations also carry an expiry. An automated expiry sweeper is required before checkout preparation is enabled in production.

Stripe/payment is still deliberately disconnected. No browser action can mark an order paid.

See `docs/COMMERCE.md`.

Commerce remains intentionally off by default:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=false
NEXT_PUBLIC_SHOP_ENABLED=false
LEGAL_COMMERCE_READY=false
CHECKOUT_PREPAYMENT_ENABLED=false
COMMERCE_STANDARD_SHIPPING_CENTS=
COMMERCE_VAT_RATE_BPS=
```

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
