# UNSAID Admin

The control room lives at `/admin/` and is intentionally separate from the public archive.

## Current phase

- GitHub Pages is the temporary public host.
- The public storefront keeps `CATALOG_SOURCE=local` and therefore does not spend Firestore reads per visitor.
- The control room uses Firebase Authentication plus the Firebase Web SDK.
- Firestore becomes the editorial source for authenticated admin work once the owner UID is authorized in Security Rules.
- Shop and checkout stay disabled.
- Firebase Storage and Cloud Functions are not required.

## Bootstrap security

The `/admin/` URL is not the security boundary. Firestore Security Rules are.

The checked-in rules remain deny-all until the owner Firebase Authentication account exists. The panel can authenticate and display the signed-in UID even while Firestore is locked. That UID is then used to authorize only the owner account in the next setup step.

Never authorize by email in Firestore rules. Never commit passwords, service-account JSON or private keys.

## Archive state

The old 81-record archive was test content and has been removed. `data/catalog/archive.json` intentionally contains an empty array until the real phrases are supplied.

When real records are added to the local archive, the admin panel can import them from the authenticated browser after Firestore rules allow the owner UID. The importer writes in small batches so the design remains compatible with larger future archives.

## Editing model

The control room supports:

- title and front/back phrase;
- category and language;
- audience (`general`, `18+`, `sensitive`, `review`);
- editorial/product state;
- price, fit and color;
- front/back media references;
- notes and publication flag.

A save updates `phrases`, `products`, `catalog` and `meta/catalogStats` together in a Firestore batch. Stable IDs remain `UNS-xxxx`; new records can be created directly from the control room.

## Public delivery

While GitHub Pages is active, admin changes do not automatically alter the static public archive. When UNSAID returns to server hosting, public reads should use the existing server-side Firestore adapter plus caching/static generation so public traffic never reads the whole database on each visit.
