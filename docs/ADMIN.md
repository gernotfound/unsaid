# UNSAID Admin

The control room lives at `/admin/`. It is an editorial system, not a second storefront.

## Editorial aggregate

Each T-shirt is edited as one canonical object: title and slug, copy for front/back, language, category, audience, lifecycle, primary archive view, front/back render state, garment data, optional future price and internal notes.

Lifecycle:

`draft -> review -> render_ready -> published -> archived`

There is no independent `publishable` flag. `published` is the only public state, which removes contradictory combinations.

## IDs, slugs and concurrency

New IDs are allocated from `meta/catalog.nextSequence` in a Firestore transaction. `UNS-xxxx` identifiers are stable and are never recycled after deletion.

Every canonical record has a numeric `revision`. Saving compares the editor revision with Firestore before writing. A stale session is rejected rather than silently overwriting a newer save.

`slugs/{slug}` is a uniqueness lock. Permanent deletion turns the lock into a tombstone instead of freeing the public URL, so deleted slugs are not reused.

## Front / back media

A published or render-ready product requires both front and back assets in `approved` state. One-sided designs still have two product images: the unprinted side can reference `/products/base/front-white.webp` or `/products/base/back-white.webp`.

If a side contains copy it cannot be marked as a blank base.

## Archive vs delete

**Archive** sets lifecycle to `archived`: the canonical record stays in Firestore but its public projection is removed.

**Delete permanently** removes canonical/public documents, but keeps the ID high-water mark and slug tombstone. Neither identity is reused.

## Scale

Admin browsing is paginated in blocks of 50. Search queries Firestore through indexed `searchTokens` instead of downloading the whole catalog. The storefront uses a server-side published projection and a local versioned fallback.

## Import

The checked-in `data/catalog/archive.json` can bootstrap an empty Firestore catalog from the control room. Import is refused if canonical records or slug locks already exist. After bootstrap, Firestore is the editorial source of truth.
