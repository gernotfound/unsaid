# UNSAID — legal/privacy launch checklist

This document is an engineering checklist, not legal advice. The current implementation assumes an Italian/EU-facing project and should be reviewed by a qualified professional before the commercial launch.

## Current state

- Public archive active.
- Checkout disabled.
- Customer-account infrastructure implemented but feature-gated.
- No newsletter.
- No payment processing.
- Optional Google Analytics is privacy-by-default and is blocked unless the minimum legal identity is configured.
- The public 18+ section has been removed.
- Customer registration requires `NEXT_PUBLIC_ACCOUNTS_ENABLED=true` plus the minimum privacy identity.
- Commerce requires the account gate, `NEXT_PUBLIC_SHOP_ENABLED=true` and `LEGAL_COMMERCE_READY=true`.

## Legal identity

Configure these server-side environment variables before treating the public legal pages as complete:

```env
LEGAL_CONTROLLER_NAME=
LEGAL_TRADING_NAME=UNSAID
LEGAL_CONTACT_EMAIL=
LEGAL_REGISTERED_ADDRESS=
LEGAL_COUNTRY=Italia
LEGAL_VAT_NUMBER=
LEGAL_FISCAL_CODE=
LEGAL_REA=
LEGAL_PEC=
LEGAL_DPO_EMAIL=
LEGAL_COMMERCE_READY=false
```

`LEGAL_DPO_EMAIL`, `LEGAL_REA`, `LEGAL_PEC` and `LEGAL_FISCAL_CODE` are only shown when present. Do not set `LEGAL_COMMERCE_READY=true` merely to make the UI green: set it only after the actual business identity and sales documentation are ready.

## Customer accounts

Account registration is deliberately behind a separate feature gate:

```env
NEXT_PUBLIC_ACCOUNTS_ENABLED=false
```

Before switching it on publicly, verify that the Privacy page accurately describes the deployed Firebase/account configuration and complete the operational process for access/export, rectification and account closure/deletion requests.

The current technical account model stores application profile data and saved Italian addresses in Firestore, but credentials remain with Firebase Authentication. Account-sensitive Firestore data is server-only; browser rules deny direct access.

Email verification is required by the commerce policy before checkout.

## Privacy

The Privacy page is structured around the information required by GDPR transparency rules:

- identity/contact details of the controller;
- purposes and legal bases;
- categories of data, including customer-account data when enabled;
- recipients/processors;
- transfer information;
- retention criteria;
- rights and withdrawal of consent;
- right to complain to the supervisory authority;
- automated decision/profiling statement.

Official references:

- GDPR, Regulation (EU) 2016/679, especially Articles 12–14: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- European Commission overview of data-subject rights: https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en
- Italian Garante: https://www.garanteprivacy.it/

## Cookies / analytics

The public site follows these implementation rules:

1. Analytics is **off by default**.
2. Firebase/Google Analytics is imported only after explicit consent.
3. Rejecting the banner and closing it with `×` both keep analytics disabled.
4. Consent is versioned and stored locally for 180 days.
5. The old v1 preference is ignored so the new privacy text receives a fresh decision.
6. Users can reopen preferences from the footer or Cookie policy.
7. On withdrawal, collection is disabled and the site makes a best-effort removal of first-party `_ga` cookies.
8. If the controller identity is not configured, analytics remains disabled even when a Measurement ID exists.

Italian Garante guidance says non-technical tracking should not run before consent, the banner can be closed while keeping default/no-tracking settings, and the banner should generally not be repeated before six months unless conditions materially change or the previous choice cannot be known.

Official reference:
https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876

Google documents default first-party GA cookie expiry as two years for `_ga` and `_ga_<container-id>`:
https://developers.google.com/analytics/devguides/collection/ga4/tag-options

The GA4 property also has a separate user/event data-retention setting. Before launch, explicitly choose and document the shortest period compatible with the actual analytics need:
https://support.google.com/analytics/answer/7667196

## Processors

Current technical providers that need to be covered by the privacy review include:

- Vercel — hosting/CDN/application delivery;
- Google Firebase — application infrastructure, database and authentication for admin/customer accounts;
- Google Analytics — only after consent.

Review the actual account plan, DPA and subprocessor configuration before launch. Do not copy generic transfer language without checking the active provider terms.

References:
- Vercel DPA: https://vercel.com/legal/dpa
- Firebase Data Processing and Security Terms: https://firebase.google.com/terms/data-processing-terms

## Before commerce is enabled

The current `/terms` page is only a pre-launch site-usage document. It is **not** sufficient as consumer sales terms.

For an Italian consumer-facing distance sale, review at minimum the pre-contract information requirements in Article 49 of the Consumer Code and the electronic-order requirements in Article 51. The final flow must clearly cover, where applicable:

- main characteristics of the goods;
- trader identity and contact details;
- total price including taxes;
- delivery/shipping costs;
- payment and delivery methods;
- delivery timing;
- complaint handling;
- withdrawal right, procedure and return costs;
- legal guarantee;
- contract duration/minimum obligations if relevant;
- accepted payment methods and delivery restrictions;
- an order button whose wording clearly communicates an obligation to pay.

Official references:
- Consumer Code, Article 49: https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-09-06;206~art49=
- Consumer Code, Article 51: https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2005-09-06;206~art51-com6=
- Legislative Decree 70/2003 on electronic commerce: https://www.normattiva.it/eli/id/2003/04/14/003G0090/CONSOLIDATED

## Color/accessibility contract

The five permanent signal colors remain brand colors. They are not automatically valid for every text/background pairing.

Current rule:

- pink `#F472B6`, cyan `#22D3EE`, amber `#FBBF24`, orange `#EA580C`: dark text on full-color fields;
- core violet `#7C3AED`: white text on full-color fields;
- accessible violet text companion `#A78BFA`: small/interactive text on dark backgrounds;
- white `#F8FAFC` and muted `#8B95A7`: primary/secondary copy on `#05070B`.

Color must never be the only representation of status. Focus indicators remain visible and interactive targets remain at least 44 px.

## Release gate

Before setting `LEGAL_COMMERCE_READY=true`:

- legal identity fields are complete;
- account privacy/export/closure support process is ready;
- Firebase authorized domains and customer email templates are reviewed;
- privacy/cookie text matches the actual production providers and settings;
- GA4 retention has been deliberately configured;
- sales terms are reviewed;
- shipping/returns/warranty process exists;
- payment provider and checkout flow are final;
- product claims, prices and stock are real;
- accessibility/responsive QA is complete;
- a professional legal review has been completed for the actual business structure and markets served.
