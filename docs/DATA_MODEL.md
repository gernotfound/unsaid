# Data model

## `catalog/{id}` — canonical private aggregate

One document per T-shirt. It contains permanent `id` + numeric `sequence`, stable unique `slug`, title, front/back copy, language/category/audience, lifecycle, primary view, front/back media state, garment fit/color, optional integer-cent price, internal notes, revision/timestamps and indexed search tokens.

Keeping the editorial object in one aggregate makes a save atomic and removes the previous phrase/product/catalog drift.

## `publicCatalog/{id}` — public projection

Exists only for canonical records with `status: published`. Internal notes and revision are omitted. Vercel reads this collection server-side with Firebase Admin.

## `slugs/{slug}`

Uniqueness lock and tombstone mapping a public slug to one catalog ID. Deleted URLs remain reserved.

## `meta/catalog`

Holds `nextSequence` plus aggregate counters used by admin/storefront. The sequence only moves forward.

## `admins/{uid}`

Optional allowlist for additional control-room users. The bootstrap owner UID remains a Security Rules fallback; the owner can add or revoke other admins without changing application code.

## Future commerce

Inventory, variants, orders and payment state stay separate from the editorial catalog. Stable catalog IDs are the join key; mutable stock/order state must not be embedded in the T-shirt document.
