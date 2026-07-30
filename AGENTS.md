# Agent instructions — Training Tracker

Private, local, offline-first training PWA (React 18 + TypeScript + Vite +
Tailwind + Dexie/IndexedDB + Zod + Recharts + i18next + vite-plugin-pwa). No
account, no backend, no cloud, no external runtime APIs, no telemetry, no direct
LLM API. Code, types and technical comments are English. Mobile-first.

## UI language (#31)

The app is DE/EN. **German is the source of truth**: put a new string in
`src/i18n/locales/de/<namespace>.ts` first — the typecheck then demands the
English counterpart, because each `en` file is declared against the German type.
Never add a visible literal to a component.

The migration is complete across the app shell, navigation, shared primitives,
home, live workout, plans, library, history, analytics and comparisons,
glossary, body data, equipment, exercises, data and backup, AI analyses,
settings, validation messages, and community/support and feedback. Keep every
area bilingual, preserve the existing German tests, and add English coverage
for new visible behavior.

Untouched system exercises are localized for display and search through their
stable `catalogKey`. Never rewrite their stored canonical name. Custom, legacy
or user-renamed exercises and historical snapshots must always display the
saved name unchanged.

**A format must never inherit the display language.** `utils/format` and
`utils/date` are locale-aware; `csv.ts` therefore keeps its own German label maps
and its own number formatting, and no export service may import `utils/format`.
`BODY_MEASUREMENT_FIELDS.label` (body CSV header) and the label maps feeding the
AI export stay canonical German until export and display values are split.
`services/exportLanguageIndependence.test.ts` enforces this — read it before
localising anything shared.

## Mandatory: existing local user data is production data

Testers already run this app with real exercises, plans, running and finished
workouts, body data, settings and exports on their devices. **A database reset,
dropping a table, clearing IndexedDB/localStorage, or discarding rows that fail
validation is NEVER a valid migration or update path.** Any change to the data
model, Dexie schema, entities, snapshots, analyses, imports or exports needs a
documented compatibility check and migration tests. If a feature cannot be built
safely against existing data, stop and document the conflict instead of resetting.

### Data-compatibility checklist (run for every data-relevant change)

- Are existing rows still read (old records without new fields must not be
  dropped by Zod — new persisted fields are optional/defaulted)?
- Are ids and relationships preserved (never re-mint ids for existing rows)?
- Does Dexie need a new schema version (next free version, additive,
  transactional, deterministic, **no backfill that guesses**)?
- Are there safe field-by-field fallbacks for absent new fields?
- Do running workouts stay usable and finished workouts stay historically correct
  (never recompute history from live master data)?
- Do backups need adjusting, and do old backups still import?
- Do the AI export/import, plan packages, builder kit or CSV need adjusting?
- Are there migration tests, and is the service worker confirmed not to wipe data?
- Does the deployment domain stay unchanged (a new origin is a separate store)?

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
- Concrete, action-oriented error messages — through the i18n namespaces in
  migrated areas, German literals only where the area is not migrated yet.
  Touch targets stay ≥44px.
- Only change files a task actually needs. No repo-wide reformatting; run
  Prettier only on changed files. Do not push, deploy or publish without an
  explicit instruction.
- Before finishing: `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run build`, and `npx prettier --check` on the changed files.
