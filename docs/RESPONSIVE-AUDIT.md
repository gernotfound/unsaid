# Responsive audit

UNSAID is mobile-first but not phone-only. Responsive behavior is treated as a layout contract, not as a scaled-down desktop screenshot.

## Audit matrix

The current storefront and product layouts were checked at portrait widths `280`, `300`, `320`, `360`, `375`, `390`, `412`, `430`, `480`, `600`, `760` and `768` px, plus common landscape phone viewports from `568×320` through `932×430`.

The admin control room was checked at `280`, `300`, `320`, `360`, `390`, `430`, `480`, `600`, `760`, `768` and representative landscape layouts including `812×375`, `844×390` and `932×430`.

## Responsive invariants

- No page-level horizontal overflow at 280 px or above; 320 px remains the primary minimum-design target.
- Touch controls are at least 44 px high where they are primary interactive targets.
- Form inputs/selects remain at 16 px on mobile to avoid iOS focus zoom.
- Product imagery keeps the approved 4:5 garment ratio on portrait phone and tablet layouts.
- `431–760px` uses the two-column archive; `430px` and below uses one column for legibility.
- Safe-area insets are respected for fixed bottom controls.
- At `761–860px` portrait, primary navigation remains available and product imagery no longer falls into the old cropped tablet state.
- Short-height landscape phones switch to a compact two-column editorial layout instead of stacking a desktop-height hero vertically.
- Landscape phones expose Archive / Manifesto in the header and remove the bottom dock to preserve usable vertical space.
- The Analytics consent panel compacts in landscape and never depends on the bottom dock for spacing.
- Long phrases, slugs and IDs may wrap rather than forcing the viewport wider.

## Regression focus

After changes to header, catalog filters, product gallery, admin forms or fixed/sticky UI, repeat checks at 320 px portrait, 430 px portrait, 768 px portrait and roughly 812×375 landscape before shipping.
