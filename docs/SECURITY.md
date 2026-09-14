# Security / commerce

## Trust boundaries

- Anonymous storefront traffic never reads Firestore directly.
- Admin catalog writes require Firebase identity plus owner/admin allowlist authorization.
- Commerce admin writes are mediated by a server API: the browser supplies a short-lived Firebase ID token, the server verifies it, checks bootstrap owner/admin allowlist authorization, and only then uses Firebase Admin.
- Customer profile/address operations require a server-verified Firebase session.
- Checkout preparation requires a server-verified, non-revoked customer session and a verified email.
- Customer profile data can never grant admin access.
- Customer and commerce Firestore collections are denied to the browser; Firebase Admin is the server authority.

## Secrets and sessions

- Server credentials never use `NEXT_PUBLIC_`.
- Firebase Auth owns passwords; UNSAID does not store them in Firestore.
- Customer sign-in exchanges a recently issued Firebase ID token for a five-day HttpOnly application session cookie.
- Sensitive account/checkout mutations verify the server session and revocation state.
- Mutations apply same-origin checks and `SameSite=Lax` cookies.
- Admin commerce endpoints do not accept UID/email claims from request bodies; authorization derives from the verified Firebase token.
- Checkout does not accept customer identity, email, price or totals as authoritative browser claims.
- Do not log auth tokens, cookies, passwords, addresses or unnecessary personal data.
- Use managed secrets in production.

## Commerce

- Provider-hosted/tokenized payments; never store raw card data.
- Revalidate SKU, price, inventory, publication state, shipping country and totals on the server.
- Italy (`IT`) is the only allowed shipping country at first launch.
- Checkout requires an authenticated account and verified email.
- The selected address is loaded by server from the authenticated customer's own address subcollection.
- Shipping and VAT values are server configuration, never browser inputs.
- Pending-order creation and stock reservation happen in one Firestore transaction.
- Checkout idempotency keys map one request fingerprint to one deterministic order; conflicting reuse fails.
- Inventory reservations use separate reservation documents with expiry timestamps.
- Manual pending-order cancellation releases stock transactionally.
- Admin stock edits preserve reserved stock and fail if requested `onHand` is lower than `reserved`.
- Product sale activation requires published editorial state, approved front/back media, a positive price and at least one active size.
- Persist processed webhook IDs when payments are added.
- Verify webhook signatures before payment/order state transitions.
- Never trust a browser redirect as proof of payment.

## Fail-closed checkout configuration

Pre-payment preparation is unavailable unless all of these are satisfied:

- public shop/account gates;
- legal commerce identity gate;
- `CHECKOUT_PREPAYMENT_ENABLED=true`;
- explicit shipping amount configuration;
- explicit VAT-rate configuration.

No default shipping price or VAT percentage is silently assumed.

Before turning the pre-payment flag on in production, an automated reservation-expiry process must be deployed and tested. An abandoned browser session must not be able to hold inventory indefinitely.

## Abuse controls

Rate-limit where measurements show abuse risk, especially:

- auth/account recovery;
- session exchange abuse;
- cart validation bursts;
- checkout preparation/cancellation;
- payment attempts;
- admin mutations;
- render/media jobs.

Firebase Authentication provides identity-provider protections, but application-level monitoring/rate limiting remains necessary where abuse appears.

## Data minimization

- Firebase Auth owns credentials.
- Customer profile documents contain only application profile metadata.
- Saved addresses are separate customer subcollection documents.
- Order documents snapshot only data needed for the commercial/fulfillment record.
- Checkout-attempt documents contain technical idempotency/request references, not card data.
- Do not mix analytics identifiers with account/order records unless a documented purpose requires it.
- Marketing consent must be separate from account creation.

## Platform hardening before payments

Before real payments are enabled:

- Content Security Policy reviewed;
- secure cookie behavior verified on the production domain;
- Firebase authorized domains and email templates reviewed;
- dependency/lockfile policy enforced;
- backup/export strategy documented;
- production error monitoring connected;
- account deletion/export process implemented and tested;
- admin recovery access tested;
- reservation-expiry sweeper operational;
- checkout rate limiting reviewed;
- payment webhook replay handling tested;
- legal/privacy pages match actual providers and data flows.
