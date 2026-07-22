# Agent instructions — Training Tracker

Private, local, offline-first training PWA (React 18 + TypeScript + Vite +
Tailwind + Dexie/IndexedDB + Zod + Recharts + vite-plugin-pwa). No account, no
backend, no cloud, no external runtime APIs, no telemetry, no direct LLM API.
UI is German; code, types and technical comments are English. Mobile-first.

## Mandatory: format-compatibility check on every change

**No change is complete until you have explicitly checked whether it affects any
import/export/backup/share/CSV/AI format.** "Not affected" is only a valid
conclusion after a real check, and it must be stated in the final report under a
**Format-Impact** section (see `docs/FORMAT_COMPATIBILITY.md`).

A change triggers a format check whenever it touches any of: a persisted field
(add/remove/rename/retype/re-mean), an enum value, a tracking type or weight
mode, the muscle-group catalog, equipment, progression values, plan / plan-item
fields, group & rest logic, set/target values, check-ins, body data, weekly
goals, analysis metrics, calculation semantics, IDs/relationships, fingerprints,
privacy options, export selection, import conflicts, plan versions, units/ranges
or validation rules. A semantic change under an unchanged field name **is** a
format change.

Formats to review (all in `docs/FORMAT_COMPATIBILITY.md`): full backup + restore
(merge/replace, legacy versions), AI analysis export + embedded response
contract + AI response import + stored analyses/export records, the plan builder
kit, the `training-plan-package` (import/export/share), block-comparison export,
sets/sessions/exercises/body-data CSV, Dexie migrations, persisted transient
state, export content previews, privacy notices.

### Rules

- Never change the meaning of a released version. Version deliberately on any
  structural/semantic change; exports always produce the current version.
- Supported older imports convert into the current internal model with
  documented, non-invented fallbacks. Newer unsupported versions are rejected
  with a clear German message, never partially ignored.
- Treat every import file as untrusted: strict Zod, no unknown-field guessing,
  free text rendered as text only (never HTML). Imports run in one Dexie
  transaction across all dependent tables and roll back fully on any error.
- Never overwrite local data without confirmation; never invent values; never
  silently drop data or re-interpret historical snapshots.
- Format names and version constants live in `src/constants/formats.ts` (or the
  format's own established constant); no scattered magic numbers.
- Keep the fixtures (previous supported version, current, deliberately invalid,
  unsupported future) and roundtrip tests green.

## Working rules

- Reuse the existing architecture, repository layer and UI primitives. No
  rewrites, no unnecessary dependencies, no regressions.
- Components go through the repository layer; domain/matching logic is pure and
  unit-tested where sensible.
- German, concrete, action-oriented error messages. Touch targets stay ≥44px.
- Only change files a task actually needs. No repo-wide reformatting; run
  Prettier only on changed files. Do not push, deploy or publish without an
  explicit instruction.
- Before finishing: `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run build`, and `npx prettier --check` on the changed files.
