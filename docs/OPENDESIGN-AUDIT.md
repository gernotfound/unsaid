# OpenDesign redesign audit — UNSAID

Applied principles from OpenDesign `redesign-existing-projects` and `frontend-design`.

## Preserve

- warm neutral background;
- black typography with one controlled acid accent;
- realistic neutral-studio product renders;
- mobile-first catalog intent;
- data-driven product archive with concept/ready states;
- separate front/back product images.

## Diagnose

- avoid generic equal-card e-commerce grids;
- distinguish idea, render review, ready and published states;
- do not couple hundreds of phrases to hand-written UI markup;
- maintain real loading/empty/error/disabled states;
- make content rating a data attribute rather than an ad-hoc visual label;
- keep product media consistent in camera, light, background and garment proportions.

## Direction

UNSAID is an editorial streetwear archive, not an AI merchandise generator. Use asymmetric layouts, strong condensed display type, warm neutrals, one acid accent, technical archive metadata and restrained interaction. The canonical implementation lives in Next.js/TypeScript under `apps/web`; `DESIGN.md` is the visual contract for all future UI and generated product media.
