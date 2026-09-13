# Catalog source

`archive.json` is the versioned fallback and Firestore seed/import source.

The previous 81-record catalog was test data and has been removed. New records must come from the real UNSAID archive.

Rules:

- public IDs use `UNS-xxxx`;
- one record represents one editorial/product concept;
- rejected or review-only material must not be public;
- images are referenced by path/URL and are not stored as Firestore bytes;
- `CATALOG_SOURCE=local` uses this snapshot as a development/emergency fallback;
- `CATALOG_SOURCE=firebase` makes Vercel read the server-side Firestore catalog.
