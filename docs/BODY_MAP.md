# Body muscle map — decision and evaluation

The masterprompt (§10) asks for an anatomically high-quality body heatmap and
to evaluate `react-muscle-highlighter` before integrating.

## Evaluation of `react-muscle-highlighter@1.2.0`

- **License:** MIT.
- **Runtime dependencies:** none (React 18/19 as a peer only).
- **Offline safety:** pure inline SVG — no `fetch`/XHR/WebSocket, no external
  images or CDN. Meets the app's "no external runtime requests" rule.
- **Coverage:** male + female, front + back figures; TypeScript types; per-part
  colour, intensity levels, and an `onBodyPartPress` tap handler.
- **Quality:** genuinely anatomical bezier paths (viewBox 724×1448, left/right
  paths per muscle) — not a placeholder figure.
- **Bundle:** ~43 KB gzip for all four bodies (for comparison, Recharts is
  ~154 KB gzip). Precache grew ~135 KB uncompressed.
- **Risks:** the package is new (first published Jan 2026, single maintainer) —
  pinned to an exact version (`1.2.0`, no caret) to avoid surprise updates.
- **Coarser regions:** the library has one `deltoids` slug (drawn on both
  views, so front/rear shoulders still land on the right figure) and no
  separate `lats`/`rhomboids` — both fold into `upper-back`. Documented in the
  adapter.

## Decision

Adopt the library as the anatomical map. Done in two steps (masterprompt §14
step 8: proof of concept, then finalise):

1. **PoC:** the non-interactive previews on the exercise detail page and the
   exercise form render `AnatomyBodyMap` (library-based).
2. **Finalised (after visual review):** the interactive analysis muscle map now
   uses `AnatomyBodyMap` too — tapping a muscle selects its slug, outlines it,
   and lists the exercises/sets that trained it. `buildRegionExerciseUsage` is
   keyed by slug to match. The old schematic `BodyMap` was removed, so the app
   has a single body system. `muscleRegions.ts` was slimmed to just the tested
   label → region map that the slug adapter composes over.

## Data rule

Presentation only. `src/features/muscles/muscleLibrary.ts` composes the existing
(tested) catalog-label → region mapping with a region → slug table, so no stored
muscle group is renamed or migrated and no schema changes. Custom muscle labels
with no region are ignored by the figure and still shown in the textual list.

## Accessibility

Colour never carries meaning alone: a legend plus a full textual list of the
primary/secondary muscles sit under every figure, and colours are CSS variables
so the figure follows the light/dark theme.
