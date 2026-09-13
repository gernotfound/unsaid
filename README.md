# UNSAID

> **wear what you wouldn't say.**

Production-oriented TypeScript monorepo for the UNSAID streetwear catalog.

## What is in this repository

- `apps/web` — Next.js storefront/application source of truth
- `apps/worker` — asynchronous render/image/email job boundary
- `packages/domain` — brand and business contracts
- `packages/db` — PostgreSQL schema
- `packages/catalog` — catalog/search contracts
- `packages/ui` — shared UI package boundary
- `data/catalog` — complete 81-concept creative archive, versioned as migration/seed data
- `apps/web/public/products/UNS-0001` — approved FRONTE / RETRO front/back assets
- `docs` — architecture, scaling, brand, data model, render pipeline and security decisions
- `DESIGN.md` — authoritative visual contract

The earlier static prototype informed the visual contract and OpenDesign audit, but `apps/web` is the only application source of truth going forward. This avoids maintaining two storefront implementations while the Next.js version evolves.

## Brand

**UNSAID**  
*wear what you wouldn't say.*

Public product IDs use `UNS-xxxx`. Historical prototype IDs are retained as `legacyId` only in migration data.

## Local development

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d
pnpm dev
```

Local infrastructure provides PostgreSQL, Redis and S3-compatible object storage through MinIO.

## Architecture

UNSAID starts as a modular monolith: stateless Next.js web, PostgreSQL, object storage/CDN, optional Redis/KV for ephemeral workloads, and an asynchronous worker boundary for render generation and background jobs. See `docs/ARCHITECTURE.md` and `docs/SCALING.md`.

## Current status

The repository is an architecture-first foundation. The catalog model, brand contract, product assets and phrase archive are in place. Storefront implementation can now evolve directly in `apps/web` without changing the underlying data or scaling boundaries.
