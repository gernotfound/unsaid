# Firestore — UNSAID

Firestore is the editorial source of truth, not the public hot path.

## Project

- Firebase project: `unsaid-54c7e`
- Region: `europe-west8` (Milan)
- Database mode: production
- Direct browser reads/writes: disabled by `firestore.rules`
- Public storefront source for now: local archive (`CATALOG_SOURCE=local`)

## Collections

### `phrases/{id}`
Creative source. The current seed uses the product ID as the phrase ID because the archive is one phrase -> one product today.

Fields include front/back text, language, category, audience, editorial status, publication flag, notes and schema version.

### `products/{id}`
Sellable/editorial design derived from a phrase.

Fields include `phraseId`, slug, title, price, product status, publication flag, fit, color, views, image references and schema version.

### `catalog/{id}`
Denormalized storefront projection matching the current `CatalogRecord` contract. This collection exists so the web application can switch from local JSON to Firestore without coupling UI components to the canonical editorial model.

### `meta/catalogStats`
Precomputed archive counts used by the storefront. This avoids recalculating aggregate counts on every request.

## Seed workflow

The checked-in archive remains the reproducible migration source.

Dry run / validation:

```bash
pnpm seed:firestore:check
```

Real write, only after Firebase Admin credentials are configured locally or in a trusted server environment:

```bash
pnpm seed:firestore
```

The seed is idempotent for known document IDs and performs 3 writes per archive record plus one stats document. It does not delete unknown Firestore documents.

## Cost discipline

- Keep GitHub Pages and static builds on `CATALOG_SOURCE=local`.
- On Vercel, read Firestore server-side through Firebase Admin.
- Cache/static-generate public pages instead of reading the entire collection per visitor.
- Store image URLs/keys in Firestore, never image bytes.
- Do not enable Firebase Storage or Functions merely to serve the current archive.
