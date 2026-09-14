# Security / commerce

## Trust boundaries

- Anonymous storefront traffic never reads Firestore directly.
- Admin writes require Firebase identity plus owner/admin allowlist authorization.
- Future customer account/order operations require a server-verified Firebase session.
- Customer profile data can never grant admin access.

## Secrets and sessions

- Server credentials never use `NEXT_PUBLIC_`.
- Customer application sessions should use HttpOnly + Secure cookies.
- Do not log auth tokens, cookies, passwords or unnecessary personal data.
- Use managed secrets in production.
- Apply CSRF/origin protections to state-changing authenticated endpoints.

## Commerce

- Provider-hosted/tokenized payments; never store raw card data.
- Revalidate SKU, price, inventory, shipping country and totals on the server.
- Italy (`IT`) is the only allowed shipping country at first launch.
- Checkout requires an authenticated account.
- Use transactional inventory reservations.
- Use idempotency keys for checkout/payment requests.
- Persist processed webhook IDs.
- Verify webhook signatures before state transitions.
- Never trust a browser redirect as proof of payment.

## Abuse controls

Rate-limit where measurements show abuse risk, especially:

- auth/account recovery;
- search;
- checkout;
- payment attempts;
- admin mutations;
- render/media jobs.

## Data minimization

- Firebase Auth owns credentials.
- Customer profile documents contain only application profile metadata.
- Order documents snapshot legally/operationally necessary purchase data.
- Do not mix analytics identifiers with account/order records unless a documented purpose requires it.
- Marketing consent must be separate from account creation.

## Platform hardening before commerce

Before checkout is enabled:

- Content Security Policy reviewed;
- secure cookie settings verified;
- dependency/lockfile policy enforced;
- backup/export strategy documented;
- production error monitoring connected;
- account deletion/export process defined;
- admin recovery access tested;
- payment webhook replay handling tested;
- legal/privacy pages match actual providers and data flows.
