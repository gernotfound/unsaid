# Catalog source

`archive.json` is the versioned bootstrap/fallback snapshot. It contains only real UNSAID records; the old test archive is not restored.

Rules:

- public IDs use monotonic `UNS-xxxx` sequences and are never reused;
- slugs are stable and reserved through tombstones;
- front and back copy/media are independent;
- `published` is the only public lifecycle state;
- one-sided designs still reference an approved blank garment image on the unprinted side;
- current `priceCents` is a transitional editorial/display field, not the future checkout source of truth;
- real commerce price, variants and inventory live in separate commerce records before sales open;
- image bytes live in `apps/web/public/products` (or a future CDN), not Firestore;
- `CATALOG_SOURCE=local` uses this snapshot as a development/emergency fallback;
- `CATALOG_SOURCE=firebase` makes Vercel read `publicCatalog` server-side.

UNSAID currently uses a continuous archive. No drop/collection field is required for product identity.
