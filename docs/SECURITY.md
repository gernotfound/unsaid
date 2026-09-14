# Security / commerce

## Trust boundaries

- Anonymous storefront traffic never reads Firestore directly.
- Admin writes require Firebase identity plus owner/admin allowlist authorization.
- Customer profile/address operations require a server-verified Firebase session.
- Customer profile data can never grant admin access.
- Customer and commerce Firestore collections are denied to the browser; Firebase Admin is the server authority.

## Secrets and sessions

- Server credentials never use `NEXT_PUBLIC_`.
- Firebase Auth owns passwords; UNSAID does not store them in Firestore.
- Customer sign-in exchanges a recently issued Firebase ID token for a five-day HttpOnly application session cookie.
- Sensitive account mutations verify the server session and revocation state.
- Account mutations apply same-origin checks and `SameSite=Lax` cookies.
- Do not log auth tokens, cookies, passwords, addresses or unnecessary personal data.
- Use managed secrets in production.

## Commerce

- Provider-hosted/tokenized payments; never store raw card data.
- Revalidate SKU, price, inventory, shipping country and totals on the server.
- Italy (`IT`) is the only allowed shipping country at first launch.
- Checkout requires an authenticated account and verified email.
- Inventory reservations use Firestore transactions and separate reservation documents.
- Reserve/release/commit operations are designed to be idempotent for the same order + variant reservation.
- Use idempotency keys for checkout/payment requests.
- Persist processed webhook IDs when payments are added.
- Verify webhook signatures before state transitions.
- Never trust a browser redirect as proof of payment.

## Abuse controls

Rate-limit where measurements show abuse risk, especially:

- auth/account recovery;
- session exchange abuse;
- search;
- checkout;
- payment attempts;
- admin mutations;
- render/media jobs.

Firebase Authentication provides identity-provider protections, but application-level monitoring/rate limiting remains necessary where abuse appears.

## Data minimization

- Firebase Auth owns credentials.
- Customer profile documents contain only application profile metadata.
- Saved addresses are separate customer subcollection documents.
- Order documents snapshot legally/operationally necessary purchase data.
- Do not mix analytics identifiers with account/order records unless a documented purpose requires it.
- Marketing consent must be separate from account creation.

## Platform hardening before commerce

Before checkout is enabled:

- Content Security Policy reviewed;
- secure cookie behavior verified on the production domain;
- Firebase authorized domains and email templates reviewed;
- dependency/lockfile policy enforced;
- backup/export strategy documented;
- production error monitoring connected;
- account deletion/export process implemented and tested;
- admin recovery access tested;
- payment webhook replay handling tested;
- legal/privacy pages match actual providers and data flows.
