# UNSAID Admin

The control room lives at `/admin/` and is intentionally separate from the public archive.

## Current phase

- Production runs on Vercel.
- The control room uses Firebase Authentication plus the Firebase Web SDK.
- Authenticated admin writes go to Firestore.
- Shop and checkout stay disabled.
- Firebase Storage and Cloud Functions are not required.

## Security

The `/admin/` URL is not the security boundary. Firestore Security Rules are.

Only the authorized Firebase Authentication UID may read/write the editorial collections. Never authorize by email in Firestore rules. Never commit passwords, service-account JSON or private keys.

## Editing model

The current control room supports:

- title and front/back phrase;
- category and language;
- audience (`general`, `18+`, `sensitive`, `review`);
- editorial/product state;
- price, fit and color;
- front/back media references;
- notes and publication flag.

A save updates `phrases`, `products`, `catalog` and `meta/catalogStats` together in a Firestore batch. Stable IDs remain `UNS-xxxx`; new records can be created directly from the control room.

## Public delivery

Vercel is the public runtime. Until Firebase Admin credentials are configured, `CATALOG_SOURCE=local` remains the safe fallback. Once `CATALOG_SOURCE=firebase` is enabled in Vercel, the public app reads Firestore only server-side through Firebase Admin.

Home, archive and product routes use Next.js revalidation so repeated public requests are served through the application/cache layer instead of forcing a full catalog read for every visitor.
