# Customer accounts

## Product decision

Customers may browse UNSAID anonymously, but an **account is required to purchase**.

Account functionality is not exposed until commerce work begins.

## Identity provider

Use Firebase Authentication for customer identity. Do not build a password database inside Firestore.

Initial supported sign-in can use email/password; additional providers can be added later without changing the customer domain.

Admin and customer accounts may exist in the same Firebase Auth tenant/project, but authorization is strictly separate:

- customer identity: valid Firebase user;
- admin identity: owner UID or explicit `/admins/{uid}` allowlist.

A field in `customers/{uid}` must never make a user an admin.

## Server session model

For account-sensitive pages, prefer a server-verifiable session:

1. browser completes Firebase sign-in;
2. identity token is exchanged/verified server-side;
3. application establishes an HttpOnly, Secure session cookie;
4. server verifies the session for account/order routes;
5. sensitive operations can verify revocation/fresh authentication where appropriate.

Do not store ID tokens in long-lived local storage as the application session strategy.

## Customer profile

`customers/{uid}` stores application profile metadata, not credentials.

Saved addresses live under `customers/{uid}/addresses/{id}`.

Initial shipping-country invariant: **IT only**.

The server validates this invariant even if the form already restricts the country.

## Checkout

Checkout requires:

- authenticated customer;
- verified server session;
- valid Italian shipping address;
- current server-side price;
- current server-side inventory;
- accepted applicable terms;
- legal/commerce feature gates enabled.

The browser cannot authoritatively provide totals, stock, tax or payment status.

## Order history

`/account/orders` should query only orders owned by the authenticated customer.

Order documents keep snapshots of:

- email used for the order;
- shipping address;
- SKU/title/size/color;
- price/tax/shipping totals.

Historical orders therefore remain correct if a customer later edits profile data.

## Privacy lifecycle

Before accounts launch, implement:

- account-data export process;
- address/profile update flow;
- account closure/deletion workflow;
- order retention rules required by accounting/legal obligations;
- separation of data that may be deleted from data that must be retained;
- no marketing opt-in bundled with account creation.

See `docs/LEGAL.md` before enabling customer registration.
