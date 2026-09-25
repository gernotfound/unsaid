# UNSAID — Media pipeline

## Decision

Product media is a generated artifact, not the source of truth for a product.

The source of truth is the combination of:

1. a versioned garment template master;
2. a versioned product render specification;
3. a versioned render profile.

The storefront consumes immutable generated media manifests. It must not repair low-quality source files with per-component quality overrides.

## Why

The first catalog prototype stored small finished WebP files directly under `apps/web/public/products`. That made the final raster file the only representation of a product image. Once those files were compressed or lost, the product could not be recreated reliably.

The media pipeline reverses that relationship:

```text
Garment template master
        +
Product render spec
        +
Render profile
        |
        v
Worker render plan
        |
        v
Managed media backend
   /             \
Rasterizer     immutable object store
   \             /
        v
immutable master + purpose derivatives
        |
        v
ProductGeneratedMediaManifest
        |
        v
Catalog/publicCatalog -> Next.js storefront
```

## Master templates

Template metadata lives in `data/media/templates.json`.

A template is versioned and has independent front/back masters. Coordinates use normalized `0..1` rectangles so a render spec is not coupled to one pixel resolution.

Template states:

- `reference-only`: useful for calibration/art direction but forbidden for production rendering;
- `ready`: clean blank master is present in canonical repository media storage and has both an immutable `storageKey` and its full SHA-256 fingerprint.

The original 2K white oversized T-shirt references supplied on 2026-09-20 are registered as `white-oversize-v1`. They contain the calibration words `FRONTE` / `RETRO` and therefore remain reference-only inputs.

Clean blank front/back master candidates have now been prepared from those references as lossless PNG sources. Their exact dimensions, byte sizes and SHA-256 digests are recorded in `data/media/master-intake.json`. That intake record is deliberately separate from `templates.json`: preparing a clean file is not the same as ingesting it into production media storage.

The template must remain `reference-only` until both hash-locked files are uploaded to the selected managed storage backend and their immutable storage keys plus full SHA-256 fingerprints are recorded. `media:validate` rejects a template that is marked ready before the corresponding intake is marked ingested.

Production rendering verifies the SHA-256 of the bytes downloaded from object storage before rasterization. This is a second integrity boundary after ingestion: a manually uploaded or later-corrupted object cannot silently become a production render source even when it exists at the expected storage key.

## Product render spec

`CatalogRecord.render` is the private reproducible recipe for the product image.

It contains:

- schema version;
- template ID/version;
- render-profile ID;
- render version;
- front/back ordered print layers.

Text layers may override placement or style, but the common typography is inherited from the versioned render profile.

`render` is private editorial/production metadata and is removed from the `publicCatalog` projection.

## Render profiles

`data/media/render-profiles.json` contains versioned output policy.

`product-standard-v1` currently defines:

- high-quality WebP detail: `1600x2000`, quality 92;
- card: `960x1200`, quality 90;
- thumbnail: `480x600`, quality 88;
- social: `1200x1500`, quality 90.

The 4:5 derivative canvas matches the storefront media slots. A rasterizer must use contain/padding rather than destructive cropping when converting the source master to a derivative canvas.

Never upscale a weak source merely to hide missing detail. The clean template master is the detail ceiling; when more detail is required, replace it with a genuinely higher-resolution master and increment the template version.

## Worker boundary

`apps/worker/src/media` owns provider-neutral render planning and media orchestration.

The planner:

- validates a render spec;
- refuses `reference-only` templates;
- resolves normalized placement to template pixels;
- produces deterministic vector text overlays;
- creates immutable output storage keys;
- carries the expected template SHA-256 into the render plan;
- builds a `ProductGeneratedMediaManifest` from backend output.

`createManagedMediaBackend()` further separates two infrastructure concerns:

- `MediaRasterizer` turns a clean source + vector overlay into a PNG master and purpose-specific WebP/AVIF derivatives;
- `MediaBinaryStore` retrieves clean masters and persists exact immutable output bytes;
- the managed backend hashes every retrieved master and refuses rasterization unless it matches the render plan's full SHA-256 fingerprint.

`RepositoryMediaObjectStore` is the production adapter for the current Spark/Hobby architecture. It maps private render inputs under `data/media/masters/**` and public generated outputs under `apps/web/public/generated/**`. Vercel serves only the latter as static assets. Rasterization remains independently injectable, so a future object-store adapter can replace the repository adapter without changing domain, catalog or frontend contracts.

This separation is deliberate: catalog/domain/frontend do not depend on Sharp, Firebase Storage, S3, R2, Vercel Blob or another provider. At the current catalog size, repository-backed binaries avoid a paid storage dependency while retaining deterministic generation and versioned review.

## Generated media manifest

`CatalogRecord.generatedMedia` contains only public generated output references and generation identity:

- product ID;
- render version;
- template ID/version;
- profile ID;
- generated timestamp;
- front/back master references;
- named derivatives.

Generated storage keys are immutable and versioned:

```text
generated/products/{productId}/{renderVersion}/{view}/master.png
generated/products/{productId}/{renderVersion}/{view}/detail.webp
generated/products/{productId}/{renderVersion}/{view}/card.webp
...
```

A new render must create a new render version/key set. Do not overwrite an existing immutable render in place. The managed backend hashes every generated object before handing it to the immutable store.

## Manifest promotion

Rendering and catalog promotion are separate operations.

A renderer should first produce a complete set of `ProductGeneratedMediaManifest` objects. Before they become catalog source data, validate them with:

```bash
pnpm media:attach-manifests -- --manifests=/absolute/path/to/generated-media.json
```

The command is dry-run by default. It verifies product identity, render/template/profile versions, immutable front/back masters and all four required derivatives. Unless `--allow-partial` is supplied, every published catalog product must be present.

After review, attach the validated manifests to the repository catalog on a branch:

```bash
pnpm media:attach-manifests -- --manifests=/absolute/path/to/generated-media.json --write-archive
```

The resulting `archive.json` diff must pass media validation, tests, typecheck and build before merge. Publishing the corresponding Firestore projection is a separate production operation; this avoids silently mutating live catalog data while a branch is still under review.

## Storefront selection

The catalog package owns media selection.

- cards request the `card` derivative;
- product pages request `detail`;
- homepage featured media requests `detail`;
- if generated media is not available yet, the legacy approved asset remains a migration fallback.

The frontend does not set ad-hoc quality values to compensate for weak sources. The web app has one global Next.js image-delivery quality allowlist (`90`), while product-specific source quality is controlled upstream by the media pipeline. Responsive `sizes`/`srcset` remain the responsibility of `next/image`.

This is intentionally two separate concerns:

- source fidelity is solved by clean high-resolution masters and purpose-built generated media;
- browser delivery is solved by responsive image optimization with a single site-wide quality policy.

## Migration

Migration is intentionally staged so public catalog availability is preserved.

1. Register template references and render profiles.
2. Add render specs to catalog records.
3. Prepare clean blank template masters and lock their hashes in `master-intake.json`.
4. Commit those exact files to `data/media/masters/**` through the verified ingestion command and only then mark template views `ready`.
5. Connect a concrete rasterizer to the provider-neutral managed backend.
6. Render every catalog product to a new immutable manifest.
7. Validate and attach `generatedMedia` to the repository catalog.
8. Publish the reviewed generated-media projection to Firestore.
9. Verify front/back images, print content and responsive presentation.
10. Only after all published products have generated media, remove repository-hosted legacy product images.

Legacy assets are fallback data during migration, not the long-term source of truth.

## Validation

`pnpm media:validate` checks:

- registry uniqueness;
- render-profile derivative definitions;
- render spec structure for every seed product;
- template/profile references;
- presence of render layers when editorial copy exists;
- clean-master intake metadata, dimensions, byte sizes and SHA-256 shape;
- `ready`/`ingested` state consistency and exact hash-derived master storage keys;
- generated-media identity and required derivative dimensions when manifests are attached.

A `reference-only` template produces a warning, not a configuration error, because the architecture can land before the clean master asset is ingested. Actual render planning still fails closed until the template is `ready`.

CI runs media validation before tests/typecheck/build.

## Storage policy

For the current six-product catalog, Git is intentionally the canonical binary store as well as the metadata store. This is a bounded architectural choice for the Spark/Hobby deployment, not a frontend workaround.

Git contains:

- clean hash-locked masters under `data/media/masters/**`;
- generated storefront derivatives under `apps/web/public/generated/**`;
- contracts, render specs, profiles and manifests;
- tests and tooling.

Masters remain outside the public Next.js directory. Generated derivatives are public static assets and are served by Vercel with a one-year immutable cache header. A new render version must use a new path; existing immutable paths are never overwritten with different bytes.

If catalog/media volume later makes Git history materially large, only the `MediaBinaryStore` adapter should change. The render specs, manifests and storefront selection contract remain unchanged.

## Executing production renders

The concrete raster adapter is `SharpRasterizer`. Sharp is an explicit worker dependency rather than an accidental transitive dependency of Next.js.

Production rendering is composed only at the worker boundary:

```text
planProductRender
      |
      v
SharpRasterizer + RepositoryMediaObjectStore
      |
      v
immutable generated objects + generated-media manifest bundle
```

Use a dry run first:

```bash
pnpm media:render-products
```

The dry run performs configuration validation and refuses to plan against a template that is not `ready`.

After the clean hash-locked masters have been committed to the canonical repository master paths and template metadata has been promoted to `ready`, render and persist immutable static outputs:

```bash
pnpm media:render-products -- --write
```

Optional flags:

- `--product=UNS-0001` renders one published product for focused QA;
- `--output=/absolute/path/generated-media.json` changes the local manifest-bundle destination.

The generated image files are written under `apps/web/public/generated/**`. The default manifest bundle path is `.media-stage/generated-media.json`; rendering never edits catalog metadata directly. The resulting bundle must pass `media:attach-manifests` before any repository catalog update, and Firestore publication remains a separate reviewed step.

`SharpRasterizer` enforces the source-fidelity rule: it validates the exact template dimensions, composites vector print overlays into a PNG master, and creates purpose-specific WebP/AVIF canvases without enlarging source raster pixels. Larger derivative canvases are padded, not upscaled.

## Local visual QA

Visual QA is deliberately available without Firebase credentials and without promoting a template to `ready` in repository metadata.

Run:

```bash
pnpm media:preview-products -- --source-dir=/absolute/path/to/hash-locked-clean-masters
```

The command:

1. verifies the exact byte length and SHA-256 values from `master-intake.json`;
2. stages those masters into an immutable local object store;
3. creates an in-memory `ready` template only for the QA process;
4. uses the same `SharpRasterizer`, render planner and derivative profile as production;
5. writes all generated files under `.media-stage/qa-media`;
6. writes a local `qa-manifests.json` bundle.

It never changes `templates.json`, `master-intake.json`, catalog data or Firestore.

Use `--product=UNS-0001` for focused QA and `--output-dir=/absolute/path` to choose another local output directory. This path is for art-direction review before managed-storage promotion, not a substitute for production ingestion.

