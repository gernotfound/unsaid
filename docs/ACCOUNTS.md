# Customer accounts

## Product decision

Customers may browse UNSAID anonymously, but an **account is required to purchase**. Initial sales are Italy-only and the catalog is continuous (no drop dependency).

## Current implementation

The account foundation is implemented but feature-gated:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=false
```

Registration becomes available only when the flag is `true` **and** the minimum privacy identity (`LEGAL_CONTROLLER_NAME` + `LEGAL_CONTACT_EMAIL`) is configured.

Implemented public/account flows:

- email/password registration through Firebase Authentication;
- email/password sign-in;
- email verification;
- password-reset email;
- HttpOnly server session exchange;
- profile name update;
- Italian shipping-address creation/deletion/default selection;
- order-history read boundary;
- logout/session removal.

The account page is `/account`.

## Identity provider

Firebase Authentication owns credentials. UNSAID never stores customer passwords in Firestore.

Admin and customer identities can exist in the same Firebase project, but authorization remains separate:

- customer identity = valid Firebase user + valid UNSAID server session;
- admin identity = bootstrap owner or `/admins/{uid}` allowlist.

A customer profile field can never grant admin rights.

## Server session model

1. Browser completes Firebase sign-in/registration.
2. The browser obtains a short-lived Firebase ID token.
3. `POST /api/auth/session` verifies the token with Firebase Admin, requires recent sign-in and establishes an HttpOnly session cookie.
4. Account APIs verify that session server-side; sensitive mutations check revocation.
5. The browser does not treat a long-lived local-storage ID token as the application authorization boundary.

The session cookie currently lives for five days. Same-origin checks and `SameSite=Lax` are applied to account mutations.

## Firestore customer data

`customers/{uid}` stores application profile metadata only:

- UID;
- email;
- optional display name;
- account status;
- default shipping address ID;
- timestamps.

Saved addresses live under:

`customers/{uid}/addresses/{addressId}`

They are validated as Italy-only (`country: IT`), with five-digit CAP and two-letter province code. A customer can save at most ten addresses in the current implementation.

Browser Firestore access to customer documents is denied. Account data is read/written through server endpoints using Firebase Admin.

## Email verification

An account can be created before the email address is verified, but the commerce policy requires verified email before checkout. This is enforced as a server/domain invariant, not just UI copy.

## Checkout boundary

A future checkout requires all of the following:

- `NEXT_PUBLIC_SHOP_ENABLED=true`;
- legal commerce gate ready;
- customer-account gate ready;
- authenticated server session;
- verified email;
- valid Italian shipping address;
- server-resolved SKU and price;
- server-resolved inventory;
- accepted applicable terms.

The browser never authoritatively provides totals, stock, tax or payment status.

## Order history

The repository can list only orders whose `customerId` matches the authenticated UID. Order documents retain snapshots of email, shipping address, line/SKU/title/size/color and monetary totals so historical orders remain correct after profile changes.

## Privacy lifecycle before commercial launch

Before customer registration is enabled publicly for a commercial launch, complete and test:

- account-data export process;
- formal account closure/deletion workflow;
- retention rules for order/accounting records;
- support path for access/rectification/deletion requests;
- final privacy wording matching the deployed configuration;
- Firebase authorized domains and email templates;
- abuse/rate-limit monitoring.

No marketing opt-in may be bundled with account creation.
