# UNSAID

> **wear what you wouldn't say.**

Production-oriented TypeScript monorepo for the UNSAID streetwear catalog.

## What is in this repository

- `apps/web` — Next.js storefront/application source of truth
- `apps/worker` — asynchronous render/image/email job boundary
- `packages/domain` — brand and business contracts
- `packages/db` — PostgreSQL schema
- `packages/catalog` — catalog/search contracts and archive loader
- `packages/ui` — shared UI package boundary
- `data/catalog` — complete 81-concept creative archive, versioned as migration/seed data
- `apps/web/public/products/UNS-0001` — approved FRONTE / RETRO front/back assets
- `docs` — architecture, scaling, brand, data model, render pipeline and security decisions
- `DESIGN.md` — authoritative visual contract

The earlier static prototype informed the visual contract and OpenDesign audit, but `apps/web` is now the only application source of truth.

## Brand

**UNSAID**  
*wear what you wouldn't say.*

Public product IDs use `UNS-xxxx`. Historical prototype IDs are retained as `legacyId` only in migration data.

## Storefront now implemented

The Next.js app already includes:

- branded editorial homepage;
- `/shop` with live search, category filters, sorting and an explicit 18+ visibility control;
- progressive catalog rendering so the browser does not mount the full archive at once;
- `/product/[slug]` routes for every public archive record;
- approved front/back gallery for `UNS-0001`;
- concept views for products whose render does not exist yet;
- branded 404, draft legal pages, metadata and favicon;
- GitHub Actions CI for install, typecheck and production build.

## Local development

```bash
corepack enable
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d
pnpm dev
```

Local infrastructure provides PostgreSQL, Redis and S3-compatible object storage through MinIO.

## Architecture

UNSAID starts as a modular monolith: stateless Next.js web, PostgreSQL, object storage/CDN, optional Redis/KV for ephemeral workloads, and an asynchronous worker boundary for render generation and background jobs. See `docs/ARCHITECTURE.md` and `docs/SCALING.md`.

## Current status

The visual storefront and catalog navigation are in place. Commerce, authentication and database-backed administration remain intentionally disconnected until the product/catalog workflow is approved.
