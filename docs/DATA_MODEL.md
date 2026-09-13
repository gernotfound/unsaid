# Data model

A **phrase is not a product**. Phrase = creative source. Product = sellable design derived from a phrase. This permits multiple layouts/colorways/garments from one phrase.

- `phrases`: front/back copy, language, tags, rating, editorial review.
- `products`: public ID/slug, phrase, state, price, fit, publication.
- `variants`: SKU, color, size, inventory.
- `product_assets`: immutable front/back/detail/lifestyle media.
- `render_jobs`: generation attempts and review lifecycle.
- `orders` / `order_items`: commercial snapshots.

State machine: `idea -> designing -> rendering -> ready -> published -> archived`.

Media: front/back are separate assets; database stores metadata/keys, not image bytes; approved asset URLs are immutable/content-hashed.
