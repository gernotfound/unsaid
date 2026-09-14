# Catalog source

`archive.json` is the versioned bootstrap/fallback snapshot. It contains only real UNSAID records; the old test archive is not restored.

Rules:

- public IDs use monotonic `UNS-xxxx` sequences and are never reused;
- one record represents one complete T-shirt editorial aggregate;
- front and back copy/media are independent;
- `published` is the only public lifecycle state;
- one-sided designs still reference an approved blank garment image on the unprinted side;
- prices are integer cents (`priceCents`), never floating-point currency;
- image bytes live in `apps/web/public/products` (or a future CDN), not Firestore;
- `CATALOG_SOURCE=local` uses this snapshot as a development/emergency fallback;
- `CATALOG_SOURCE=firebase` makes Vercel read `publicCatalog` server-side.
