# UNSAID — Clean master ingestion

This runbook covers the boundary between an approved clean garment image and the production render pipeline.

## Current clean masters

`data/media/master-intake.json` is the authoritative intake receipt for `white-oversize-v1@1`.

The prepared files are:

- `white-oversize-v1-front-master.webp` — `1536x2048`, `166216` bytes, SHA-256 `e1d79036772c2aabb7de9357f4a87ea24c3dbf1884d51b2e88474918a9ee957d`;
- `white-oversize-v1-back-master.webp` — `1536x2048`, `165438` bytes, SHA-256 `2f7f5c5527029f9d397cb5cb4e15fe9527f377e2b9a39bb98844d90fa7343984`.

The hashes are part of the media contract. A visually similar regenerated file is a different master and requires a new intake/version rather than silently replacing these bytes.

## Verification and staging

The worker verifies byte length and SHA-256 before any storage write:

```bash
pnpm media:stage-masters -- /absolute/path/to/clean-masters
```

An optional second argument changes the local staging root:

```bash
pnpm media:stage-masters -- /absolute/path/to/clean-masters /tmp/unsaid-media-stage
```

The default staging root is `.media-stage/`, which is ignored by Git.

Staged keys are immutable and include a digest prefix, for example:

```text
masters/templates/white-oversize-v1/v1/front-e1d79036772c2aab.webp
masters/templates/white-oversize-v1/v1/back-2f7f5c5527029f9d.webp
```

Writing the same bytes to the same key is idempotent. Writing different bytes to an existing immutable key is rejected.

## Production object storage contract

Managed storage must implement the `MasterObjectStore` contract from `apps/worker/src/media/intake.ts`:

- accept an immutable storage key;
- persist the exact supplied bytes;
- reject replacement with different bytes;
- preserve the supplied MIME type;
- keep the object available to the raster/render worker.

The contract intentionally does not name Vercel Blob, S3, R2, Cloudinary or another provider. Provider choice remains an adapter decision.

## Promotion to `ready`

Preparing or locally staging a master does **not** make a template production-ready. Promotion is a reviewed repository operation:

1. verify both clean files against `master-intake.json`;
2. upload those exact bytes to managed object storage using immutable keys;
3. verify the stored objects and record their final storage keys;
4. on a dedicated branch, change both `white-oversize-v1@1` views in `data/media/templates.json` from `reference-only` to `ready` and add the immutable `storageKey` values;
5. change the intake status to `ingested` without altering the fingerprints;
6. run `pnpm media:validate`, tests, typecheck and build;
7. render every published product to a new immutable generated-media manifest;
8. verify front/back copy, complete garment silhouette, responsive delivery and image sharpness;
9. merge through PR only after validation succeeds.

Until step 4 is complete, `planProductRender()` fails closed by design. Legacy approved storefront images remain the migration fallback.

## Git policy

Do not commit the high-resolution source masters or a growing derivative library to Git as the permanent media store. Git contains the contracts, hashes, render specifications and migration tooling; managed object storage contains production binary media.
