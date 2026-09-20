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
Raster/storage backend
        |
        +--> immutable master render
        +--> detail derivative
        +--> card derivative
        +--> thumbnail derivative
        +--> social derivative
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
- `ready`: clean blank master is present in managed media storage and has a `storageKey`.

The original 2K white oversized T-shirt references supplied on 2026-09-20 are registered as `white-oversize-v1`. They contain the calibration words `FRONTE` / `RETRO` and therefore remain reference-only inputs.

Clean blank front/back master candidates have now been prepared from those references. Their exact dimensions, byte sizes and SHA-256 digests are recorded in `data/media/master-intake.json`. That intake record is deliberately separate from `templates.json`: preparing a clean file is not the same as ingesting it into production media storage.

The template must remain `reference-only` until both hash-locked files are uploaded to the selected managed storage backend and their immutable storage keys are recorded. Do not mark a template `ready` merely to bypass this gate.

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

The 4:5 derivative canvas matches the storefront media slots. A raster backend should use contain/padding rather than destructive cropping when converting the source master to 4:5 output.

Never upscale a weak source merely to hide missing detail. The clean template master is the detail ceiling; when more detail is required, replace it with a genuinely higher-resolution master and increment the template version.

## Worker boundary

`apps/worker/src/media` owns provider-neutral render planning.

The planner:

- validates a render spec;
- refuses `reference-only` templates;
- resolves normalized placement to template pixels;
- produces deterministic vector text overlays;
- creates immutable output storage keys;
- orchestrates front/back output through a `MediaRenderBackend` contract;
- builds a `ProductGeneratedMediaManifest` from backend output.

Rasterization/storage stays behind `MediaRenderBackend`. The production adapter may use Sharp plus object storage/CDN, but catalog/domain/frontend contracts must not depend on Sharp, S3, R2, Vercel Blob or another provider.

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

A new render must create a new render version/key set. Do not overwrite an existing immutable render in place.

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
4. Upload those exact files to managed object storage/CDN and only then mark template views `ready`.
5. Connect a raster/storage backend to `MediaRenderBackend`.
6. Render every catalog product to a new immutable manifest.
7. Attach `generatedMedia` to the private catalog record and public projection.
8. Verify front/back images, print content and responsive presentation.
9. Only after all published products have generated media, remove repository-hosted legacy product images.

Legacy assets are fallback data during migration, not the long-term source of truth.

## Validation

`pnpm media:validate` checks:

- registry uniqueness;
- render-profile derivative definitions;
- render spec structure for every seed product;
- template/profile references;
- presence of render layers when editorial copy exists;
- clean-master intake metadata, dimensions, byte sizes and SHA-256 shape.

A `reference-only` template produces a warning, not a configuration error, because the architecture can land before the clean master asset is ingested. Actual render planning still fails closed until the template is `ready`.

CI runs media validation before tests/typecheck/build.

## Storage policy

Master templates and generated derivatives belong in managed object storage/CDN before the legacy repository assets are retired.

Git should contain:

- contracts;
- render specs;
- render profiles;
- template metadata;
- master intake hashes/metadata;
- tests and tooling.

Git should not become the long-term binary archive for high-resolution masters and every generated derivative.
