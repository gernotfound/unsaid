# Catalog source

`archive.json` is the versioned source used by the temporary static storefront and by the Firestore seed/import path.

The previous 81-record catalog was test data and has been removed. The archive intentionally starts empty until the real UNSAID phrases are supplied.

Rules for the next import:

- public IDs use `UNS-xxxx`;
- one record represents one editorial/product concept;
- rejected or review-only material must not be public;
- images are referenced by path/URL and are not stored as Firestore bytes;
- the database can be seeded from this file, but the public GitHub Pages build continues to use this local source until server hosting returns.
