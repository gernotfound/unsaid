# Firestore — UNSAID

Firestore is the editorial source of truth, not a database that anonymous visitors access directly.

## Project

- Firebase project: `unsaid-54c7e`
- Region: `europe-west8` (Milan)
- Database mode: production
- Authentication: Email/Password for the control room
- Public runtime: Vercel / Next.js

## Collections

### `phrases/{id}`
Creative source. The current model uses the product ID as the phrase ID because the archive is one phrase -> one product today.

Fields include front/back text, language, category, audience, editorial status, publication flag, notes and schema version.

### `products/{id}`
Sellable/editorial design derived from a phrase.

Fields include `phraseId`, slug, title, price, product status, publication flag, fit, color, views, image references and schema version.

### `catalog/{id}`
Denormalized storefront projection matching the current `CatalogRecord` contract. This lets the web application switch between local JSON and Firestore without coupling UI components to Firebase.

### `meta/catalogStats`
Precomputed archive counts used by the storefront.

## Seed workflow

The checked-in archive remains the reproducible migration/fallback source.

Dry run / validation:

```bash
pnpm seed:firestore:check
```

Real write, only with Firebase Admin credentials in a trusted server environment:

```bash
pnpm seed:firestore
```

## Vercel data flow

Keep this while Firebase Admin is not configured:

```env
CATALOG_SOURCE=local
```

After adding `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` as server-only Vercel environment variables, switch to:

```env
CATALOG_SOURCE=firebase
```

The browser does not receive those credentials. Public pages read Firestore on the server and use Next.js revalidation/caching between Firestore and anonymous traffic.

## Cost discipline

- Do not grant broad anonymous Firestore reads.
- Read Firestore server-side through Firebase Admin on Vercel.
- Cache/revalidate public pages instead of reading the entire collection per visitor.
- Store image references in Firestore, never image bytes.
- Do not enable Firebase Storage or Functions merely to serve the current archive.
