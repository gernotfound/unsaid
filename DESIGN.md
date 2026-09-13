# UNSAID — Design system

> **wear what you wouldn't say.**

## Brand idea

**UNSAID** trasforma ciò che normalmente rimane non detto in qualcosa da indossare. Il brand deve sembrare editoriale e streetwear, non un generatore di merchandise. Il testo è il prodotto: ironico, provocatorio, assurdo o riflessivo a seconda della frase.

## 1. Intent
UNSAID è un archivio streetwear di frasi stampate su t-shirt. Deve sembrare più vicino a un catalogo editoriale indipendente che a un template e-commerce. La memoria visiva chiave: fondo caldo, fotografia neutra, titoli enormi e compressi, una sola tinta acida controllata, informazioni tecniche trattate come annotazioni di archivio.

## 2. Voice
- Tagline primaria: `wear what you wouldn't say.`
- Tono: asciutto, intelligente, provocatorio senza spiegare troppo.
- Evitare copy da startup, claim generici e linguaggio da "AI merch generator".
- Il marchio è sempre scritto `UNSAID`.

## 3. Atmosphere
Editoriale, ironica, asciutta, collezionistica. Nessun gradiente viola/azzurro, nessun glass-card decorativo, nessuna icon-row generica. La UI deve far percepire che esistono centinaia di pezzi senza diventare rumorosa.

## 4. Color roles
- Canvas: `#efede6`
- Paper: `#f8f6ef`
- Ink: `#151512`
- Muted ink: `#6e6b62`
- Hairline: `#c8c3b8`
- Soft field: `#dedad0`
- Accent / status ready: `#c7d86c`
- Warning / sensitive: `#d9a65a`
- Error / review: `#9e4e42`

One accent only. The acid tone is a brand cue, not a decoration.

## 5. Typography
- Display: condensed/heavy local stack (`Arial Narrow`, `Aptos Narrow`, `Helvetica Neue Condensed`, fallback sans-serif), 800–900 weight, tight tracking, compact leading.
- Editorial accent: Georgia italic for occasional human notes.
- Body: Aptos / Helvetica Neue / Arial, 400–650.
- Metadata and IDs: SFMono / Consolas / Liberation Mono, tabular numbers.
- Large text uses `text-wrap: balance`; body copy uses `text-wrap: pretty` and max-width around 62–68 characters.

## 6. Layout
- Desktop container max width: 1560px.
- Hero is asymmetrical 7/5 split.
- Catalog is a 12-column editorial grid: selected entries span more columns; never a uniform 3-card feature row.
- Tablet/mobile transition starts at 760px: desktop navigation disappears and the page becomes a deliberate single-column editorial flow.
- Mobile catalog uses 2 columns from 431–760px and 1 column at 430px and below so long phrases remain readable rather than becoming miniature desktop cards.
- Product detail uses a right-hand sheet on desktop; on mobile the media becomes full-bleed and the information sheet follows below it.
- Mobile navigation uses a fixed rectangular bottom dock with Home / Archive / Shop soon. No floating rounded nav or generic app-style pill bar.

## 7. Product imagery
- Approved render language: neutral light-gray studio backdrop, white/neutral oversized t-shirt, realistic cotton texture and folds, straight-on product photography.
- Front and back are separate image files.
- Printed words must deform naturally with fabric folds and perspective.
- Future generated assets should preserve camera height, light direction, background tone and shirt proportions across the catalog.

## 8. Components
- Product cards: image/typographic surface + information below; no floating white card with generic shadow.
- Statuses: square/archive labels, not pill badges everywhere.
- Buttons: compact, mostly rectangular; filled black reserved for primary action.
- Filters: horizontal text/chip strip; active state uses ink background.
- Product sheet: side panel with front/back switch, specs, size selection and clear state (`ready`, `concept`, `review`).

## 9. Interaction
- 180–260ms transitions using transform/opacity.
- Hover: subtle media zoom and underlined text; press: `translateY(1px)`.
- Visible `:focus-visible` outline on every interactive control.
- Respect `prefers-reduced-motion`.
- Search/filter result changes update an ARIA live region.
- Touch controls are at least 44px high; mobile search/select fields stay at 16px or above to prevent iOS auto-zoom.

## 10. Responsive and performance
- No external fonts or UI libraries unless intentionally introduced later.
- Product images are WebP/AVIF and lazy-loaded outside the hero.
- Catalog endpoints use pagination/cursors; never render thousands of products at once.
- Use `content-visibility:auto` on offscreen sections/cards where safe.
- Use safe-area insets for mobile bottom controls and `viewport-fit=cover`.
- On mobile, product media uses the garment's native 4:5 visual ratio instead of viewport-height placeholders; this prevents oversized first screens and keeps the product/copy relationship intentional.
- Sticky filters must not cover the header and horizontal filter strips must remain scrollable without causing page-level horizontal overflow.
