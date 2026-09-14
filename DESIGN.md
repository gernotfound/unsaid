# UNSAID — Design system v2

> **wear what you wouldn't say.**

## 0. Brand thesis

UNSAID turns thoughts that normally stay unspoken into things you can wear. The product is a monochrome T-shirt carrying a statement; the brand world around it is darker, louder and more chromatic than the garment itself.

The public site must feel like an independent fashion label with a precise visual system, not a generic ecommerce template, SaaS dashboard, AI merch generator or gaming interface.

**Primary visual direction:** `FASHION FLUO`.

## 1. Core identity

UNSAID is built from five stable ingredients:

1. **Dark-first interface** — almost-black backgrounds are the default canvas.
2. **Fluorescent signal colors** — pink, cyan, violet, amber and orange are permanent brand colors.
3. **Monochrome garments** — phase one uses white and black T-shirts only.
4. **Variable typography on garments** — the type treatment may change radically from product to product.
5. **UNSAID MODEL 01** — one canonical humanoid bot used as the recurring fashion model.

The system should remain recognizable even when the logo is removed from a screenshot.

## 2. Color system

### Structural colors

- `Night 950` — `#05070B` — page background
- `Night 900` — `#070B14` — secondary background
- `Night 800` — `#0D131D` — panels / raised surfaces
- `Night 700` — `#151D29` — interactive hover surface
- `White` — `#F8FAFC` — primary text
- `Muted` — `#8B95A7` — secondary copy / metadata
- `Hairline` — `rgba(248, 250, 252, 0.14)` — rules / dividers
- `Hairline strong` — `rgba(248, 250, 252, 0.28)`

### Permanent signal colors

- `Pink` — `#F472B6`
- `Cyan` — `#22D3EE`
- `Violet` — `#7C3AED`
- `Amber` — `#FBBF24`
- `Orange` — `#EA580C`

These five colors are part of the brand permanently. They are not status colors and they are not seasonal replacements for one another.

### Usage rule

A page may contain all five colors, but **one visual block should have one dominant signal color**. Avoid rainbow gradients spanning all five at once. Color should create rhythm and hierarchy, not noise.

Use full fluorescent fields with dark text when the color is the subject. Use low-opacity glows only as secondary atmosphere. Avoid glassmorphism as a default surface treatment.

## 3. Garment system

Phase one garments are:

- solid white;
- solid black.

The garment acts as the neutral object inside the fluorescent brand environment.

Front and back are independent art surfaces. Each product can use a different typeface, type scale, alignment, distortion and composition. The product artwork does **not** need to use the website display font.

A product record should conceptually separate:

- garment color;
- front copy;
- back copy;
- front artwork;
- back artwork;
- clean product renders;
- editorial/model imagery.

The storefront must never imply that a temporary render is an exact promise of the final physical blank until the real garment base is chosen.

## 4. UNSAID MODEL 01

The humanoid bot is a recurring brand asset, not a disposable AI character.

### Canonical invariants

Across all future renders and video, MODEL 01 must preserve:

- the same head shape;
- the same facial blankness;
- the same body proportions;
- the same joint design;
- the same hand/foot geometry;
- the same overall silhouette;
- the same premium studio-object feeling.

### Allowed variation

- material/colorway of shell panels;
- lighting color;
- background color;
- pose and camera angle;
- garment color;
- garment artwork.

Changing the color must never result in a visibly different robot design.

### Current reference language

Off-white and graphite humanoid, smooth featureless face, restrained mechanical detail, clean fashion-studio lighting. It should feel closer to a premium mannequin/lookbook model than to a sci-fi combat robot.

### Asset strategy

Maintain a canonical MODEL 01 reference set before generating large volumes of editorial media. Future generation prompts, 3D work or video should reference that source set. Store editorial/model images separately from clean product images.

## 5. Typography

### Interface display

Use a heavy grotesk/system stack until a deliberate brand typeface is selected:

`Arial Black`, `Helvetica Neue`, `Arial`, sans-serif.

Large display text is uppercase, dense and direct. Avoid decorative effects on every headline; scale and composition should carry most of the impact.

### Body

`Inter`-like system sans stack: `Arial`, `Helvetica Neue`, system-ui, sans-serif.

### Technical metadata

Use a monospace stack:

`SFMono-Regular`, `Consolas`, `Liberation Mono`, monospace.

Metadata is compact, uppercase and functional.

### Product artwork

Not governed by the interface font. Every shirt can have its own typographic treatment.

## 6. Layout language

The public storefront uses strong editorial blocks rather than generic cards floating on a background.

- Desktop max width: `1600px` for constrained content.
- Full-bleed hero and signal sections may span the viewport.
- Base grid: 12 columns desktop, 6 tablet, 4 mobile.
- Product grid: 4 columns wide desktop, 3 medium desktop, 2 tablet, 1 narrow mobile.
- Use hard rules, color fields and image crops to define sections.
- Border radius is restrained; large rounded SaaS cards are not part of the core language.
- White/light studio product imagery should sit cleanly against the dark interface.

## 7. Homepage

The homepage is a brand experience first and a catalog gateway second.

Required rhythm:

1. **Hero** — giant typography + MODEL 01.
2. **Signal rail** — the permanent five-color brand system.
3. **Latest archive** — a small server-rendered selection of products.
4. **MODEL 01 statement** — explain the recurring model system visually, not as a technical tutorial.
5. **Manifesto** — short, memorable, not a long startup story.
6. **Footer** — oversized UNSAID identity and legal/navigation links.

Do not use generic "how it works" steps unless there is an actual customer need.

## 8. Archive / shop

The archive is server-first and must remain fast when the catalog grows.

- Never hydrate the full catalog into the browser.
- Page size target: 24 products.
- Cursor pagination, not array slicing of thousands of records.
- Sorting is server-side.
- Full-text search is introduced only with a bounded server-side search implementation or a dedicated search index; never by downloading the whole catalog to the client.
- The public interface currently has **no 18+ section, toggle or age filter**.
- Internal editorial classifications may remain private if useful operationally.

Cards prioritize:

1. product image;
2. product ID;
3. title / statement;
4. garment color / print side;
5. price only when commerce is enabled and the price is real.

## 9. Product page

The product page is a fashion product sheet, not a marketplace listing.

- Large image stage.
- Explicit front/back switch.
- Product statement is prominent.
- Fit, garment color and print placement are concise.
- Size/commerce controls appear only when commerce data is valid.
- Keep operational/internal status language out of the customer-facing page.
- Editorial MODEL 01 imagery can be added as a separate media type without replacing clean front/back renders.

## 10. Public UI interaction

- Motion: 160–280 ms for ordinary state changes.
- Large editorial transitions may be slower, but never block interaction.
- Hover is subtle on product imagery; fluorescent color can intensify on focus/hover.
- `:focus-visible` must always be obvious.
- Touch targets: minimum 44 px.
- Respect `prefers-reduced-motion`.
- No horizontal page overflow down to 320 px.
- Safe-area insets are required for fixed mobile controls.

## 11. Admin / control room

The admin is deliberately **not** a creative clone of the storefront.

It should feel like a professional technical application:

- dark mode;
- dense information hierarchy;
- clear tables/lists/forms;
- explicit status and revision information;
- high contrast;
- minimal decoration;
- predictable controls;
- server/database terminology is acceptable here;
- pagination and search must continue to work with a large catalog.

Brand signal colors may appear sparingly for focus, selected state and operational emphasis. They should not reduce readability.

## 12. Responsive strategy

### Desktop

Editorial asymmetry is encouraged. MODEL 01 and product imagery can occupy large visual fields.

### Tablet

Prefer deliberate two-column compositions where space allows, otherwise switch to one column before content becomes cramped.

### Mobile

Mobile is not a scaled desktop screenshot.

- One primary idea per viewport region.
- Giant typography may wrap aggressively but must not clip.
- Product cards become one column on narrow phones.
- The fixed mobile dock must account for safe areas.
- Product media stays readable and uses a stable portrait ratio.

### Short landscape phones

Avoid fixed elements consuming excessive height. The primary navigation can collapse to a compact horizontal header and the dock may disappear.

## 13. Performance contract

- Prefer Server Components for catalog/product rendering.
- Client components only for real interaction (gallery, consent, commerce, admin).
- Public catalog data is fetched server-side.
- Homepage must not full-scan the catalog to find one featured product.
- Catalog pages use cursor pagination.
- Product images use WebP/AVIF where practical.
- Below-fold imagery is lazy-loaded.
- Editorial video must have a poster, should be compressed deliberately and must not become an LCP regression.
- Avoid introducing large UI libraries for simple presentation.

See `docs/SCALING.md` for architecture limits and growth rules.

## 14. Accessibility

Fluorescent does not mean low contrast.

- Black/dark text on full pink/cyan/amber fields where contrast allows.
- White text on night surfaces.
- Violet/orange should be tested before carrying small text.
- Color is never the only signal for state.
- Images need useful alt text; purely decorative color blocks remain hidden from assistive technology.

## 15. Things UNSAID should not become

- generic Shopify template;
- purple-blue SaaS gradient site;
- glass-card dashboard storefront;
- cyberpunk game UI;
- AI-generated character gallery where the model changes every image;
- fashion site with so much animation that shopping becomes difficult;
- client-side app that downloads thousands of products before becoming useful.
