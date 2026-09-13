# Security / commerce

- Server-side authorization for admin mutations.
- Provider-hosted/tokenized payments; do not store card data.
- Revalidate SKU, inventory and price on the server at checkout.
- Idempotency keys for checkout/webhooks; persist processed webhook IDs.
- Verify webhook signatures.
- Rate-limit auth, search abuse, checkout, admin and render jobs.
- Content rating is a database attribute (`general`, `18+`, `sensitive`).
- Managed secrets, CSP, secure cookies, CSRF protection, backups and dependency scanning before production.
