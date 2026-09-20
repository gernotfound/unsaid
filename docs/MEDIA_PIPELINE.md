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

The 2K white oversized T-shirt references supplied on 2026-09-20 are registered as `white-oversize-v1`. They are intentionally `reference-only` because the supplied files contain the words `FRONTE` / `RETRO`. They must be cleaned into blank masters before rendering is enabled.

Do not mark a template `ready` merely to bypass this gate.

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

The 4:5 derivative canvas matches the storefront media slots. A raster backend should use contain/padding rather than destructive `object-fit: cover` cropping when converting the 3:4 source master to 4:5 output.

Never upscale a source master merely to satisfy an output size. A backend should preserve the source detail ceiling (`withoutEnlargement` or equivalent) and use a larger clean master when more detail is required.

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

The current foundation deliberately keeps rasterization/storage behind `MediaRenderBackend`. The production adapter may use Sharp plus object storage/CDN, but catalog/domain/frontend contracts must not depend on Sharp, S3, R2, Vercel Blob or another provider.

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

The frontend does not set ad-hoc quality values to compensate for weak sources. Generated derivatives are already encoded for their purpose and may be delivered directly by the media CDN.

## Migration

Migration is intentionally staged so public catalog availability is preserved.

1. Register template references and render profiles.
2. Add render specs to catalog records.
3. Produce clean blank template masters and mark template views `ready` only after upload.
4. Connect a raster/storage backend to `MediaRenderBackend`.
5. Render every catalog product to a new immutable manifest.
6. Attach `generatedMedia` to the private catalog record and public projection.
7. Verify front/back images, print content and responsive presentation.
8. Only after all published products have generated media, remove repository-hosted legacy product images.

Legacy assets are fallback data during migration, not the long-term source of truth.

## Validation

`pnpm media:validate` checks:

- registry uniqueness;
- render-profile derivative definitions;
- render spec structure for every seed product;
- template/profile references;
- presence of render layers when editorial copy exists.

A `reference-only` template produces a warning, not a configuration error, because the architecture can land before the clean master asset is ingested. Actual render planning still fails closed until the template is `ready`.

CI runs media validation before tests/typecheck/build.

## Storage policy

Master templates and generated derivatives should move to managed object storage/CDN before the legacy repository assets are retired.

Git should contain:

- contracts;
- render specs;
- render profiles;
- template metadata;
- tests and tooling.

Git should not become the long-term binary archive for high-resolution masters and every generated derivative.
