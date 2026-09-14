# Firestore — UNSAID

Firestore becomes the editorial source of truth when Vercel is configured with Firebase Admin credentials.

## Project

- Firebase project: `unsaid-54c7e`
- Region: `europe-west8`
- Authentication: Email/Password for `/admin/`
- Public runtime: Vercel / Next.js

## Collections

- `catalog/{id}` — canonical private editorial record
- `publicCatalog/{id}` — published projection without internal notes/revision
- `slugs/{slug}` — uniqueness lock + deletion tombstone
- `meta/catalog` — next sequence + aggregate counters
- `admins/{uid}` — optional additional admin allowlist

Schema version: **3**.

## Security

The control-room URL is not the security boundary; Firestore Security Rules are. The bootstrap owner UID remains authorized in rules, while extra admin users can be represented by `admins/{uid}` documents.

Anonymous browser reads stay closed. Public pages use Firebase Admin server-side, so storefront traffic does not consume Firestore through direct browser reads.

## Save transaction

Saving a record performs one transaction: read canonical/meta, verify revision, reserve an ID for new records, verify the slug lock, write the canonical record, write/remove the public projection, update the slug lock and aggregate counters.

This prevents duplicate IDs, duplicate slugs and silent concurrent overwrites.

## Seed / validation

Dry run:

```bash
pnpm seed:firestore:check
```

Trusted initial write with Firebase Admin credentials:

```bash
pnpm seed:firestore
```

The seed refuses to write into a non-empty catalog/slug-lock space.
