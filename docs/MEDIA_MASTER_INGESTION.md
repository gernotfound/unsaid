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

## Production adapter: Firebase Storage

The first production storage adapter is the existing Firebase project. This is an infrastructure adapter, not a domain dependency: render specs, manifests and storefront code remain provider-neutral.

Server-side media operations require:

- `FIREBASE_PROJECT_ID`;
- `FIREBASE_CLIENT_EMAIL`;
- `FIREBASE_PRIVATE_KEY`;
- `FIREBASE_STORAGE_BUCKET`.

`packages/db/src/mediaStorage.ts` provides immutable Firebase Storage writes using an object-generation precondition. If an object key already exists, the adapter verifies the existing bytes have the same SHA-256; different content at an immutable key is rejected.

Storage Security Rules are deliberately narrow:

- `masters/**` is never public;
- `generated/products/**` is public-read for storefront delivery;
- browser/client writes are denied everywhere;
- every other path fails closed.

The Admin SDK is the only write path for this media pipeline.

## Managed ingestion

First perform a dry run against the exact source directory:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters
```

This verifies both files and prints the immutable destination keys without writing remotely.

To upload the exact hash-locked bytes:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters --write
```

To upload and then promote the repository metadata in the same local working branch:

```bash
pnpm media:ingest-masters -- --source-dir=/absolute/path/to/clean-masters --write --promote-template
```

`--promote-template` is rejected unless `--write` is also present. Promotion occurs only after both uploads have completed and been verified. It updates `templates.json` with the immutable keys and marks the intake `ingested`; the resulting repository diff must still be reviewed, validated and committed on a branch.

## Promotion to `ready`

Preparing or locally staging a master does **not** make a template production-ready. Promotion remains a reviewed repository operation:

1. verify both clean files against `master-intake.json`;
2. dry-run the managed ingestion command;
3. upload those exact bytes to Firebase Storage using immutable keys;
4. verify the stored objects;
5. promote both `white-oversize-v1@1` views to `ready` and record their immutable `storageKey` values;
6. change the intake status to `ingested` without altering its fingerprints;
7. run `pnpm media:validate`, tests, typecheck and build;
8. render every published product to a new immutable generated-media manifest;
9. verify front/back copy, complete garment silhouette, responsive delivery and image sharpness;
10. merge through PR only after validation succeeds.

Until step 5 is complete, `planProductRender()` fails closed by design. Legacy approved storefront images remain the migration fallback.

## Firebase rules deployment

`firebase.json` now includes `storage.rules`. Before generated media can be consumed publicly, deploy the reviewed Storage Rules to the same Firebase project. Do not broaden the catch-all rule to public write access.

## Git policy

Do not commit the high-resolution source masters or a growing derivative library to Git as the permanent media store. Git contains the contracts, hashes, render specifications and migration tooling; managed object storage contains production binary media.
