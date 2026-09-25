# UNSAID — Clean master ingestion

This runbook covers the boundary between an approved clean garment image and the production render pipeline.

## Deployment constraint

UNSAID currently uses Firebase Spark. Cloud Storage is not part of the production architecture.

For the current catalog, canonical media is repository-backed:

- private render inputs: `data/media/masters/**`;
- public generated storefront files: `apps/web/public/generated/**`;
- Vercel serves only the generated public directory.

The media contracts remain provider-neutral so this backend can be replaced later without changing catalog or storefront semantics.

## Current clean masters

`data/media/master-intake.json` is the authoritative intake receipt for `white-oversize-v1@1`.

Expected canonical lossless files:

- `white-oversize-v1-front-master.webp` — `1536x2048`, `166216` bytes, SHA-256 `e1d79036772c2aabb7de9357f4a87ea24c3dbf1884d51b2e88474918a9ee957d`;
- `white-oversize-v1-back-master.webp` — `1536x2048`, `165438` bytes, SHA-256 `2f7f5c5527029f9d397cb5cb4e15fe9527f377e2b9a39bb98844d90fa7343984`.

A visually similar regenerated file is a different master and requires a new template version.

## Verification

Dry-run the exact files first:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters
```

The command verifies byte length and full SHA-256 and performs no write.

## Repository ingestion

Copy the exact verified bytes into their immutable canonical paths:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters --write
```

Canonical paths are digest-derived:

```text
data/media/masters/templates/white-oversize-v1/v1/front-56709598a3e0a4d1.png
data/media/masters/templates/white-oversize-v1/v1/back-300a32370560b6bd.png
```

Writing identical bytes again is idempotent. Different bytes at an existing immutable key are rejected.

After reviewing the binary diff, promote metadata on the same feature branch:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters --write --promote-template
```

Promotion records the full SHA-256 in `templates.json` and marks the intake backend as `repository-static`.

## Rendering

Once the template is `ready`:

```bash
pnpm media:render-products -- --write
```

The renderer:

1. loads master bytes from `data/media/masters/**`;
2. verifies their full SHA-256 again before rasterization;
3. applies deterministic vector artwork with Sharp;
4. writes immutable derivatives to `apps/web/public/generated/**`;
5. produces the generated-media manifest bundle separately.

Generated files are served by Vercel with an immutable cache header. A new render must use a new render version/path; never replace different bytes at an existing generated key.

## Promotion checklist

Before merge:

1. master byte lengths and SHA-256 match `master-intake.json`;
2. template is `ready` only after canonical master files exist;
3. all six products render front/back successfully;
4. visual QA confirms copy, placement, silhouette and sharpness;
5. generated manifest attachment validates;
6. tests, typecheck and production build pass;
7. merge through PR only; never work directly on `main`.

Firebase Storage rules and Firebase Storage credentials are not part of this pipeline.
