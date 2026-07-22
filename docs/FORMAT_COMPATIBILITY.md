# Format compatibility register

Every importable/exportable file this app produces or reads. **Read this before
any change that could touch a format** (see `AGENTS.md` for the rule). Format
names and versions are centralised in `src/constants/formats.ts` or the format's
own established constant.

General rules:

- The format name and version live in the file **content**, not just the name.
- Exports always produce the current version. Supported older imports convert
  into the current internal model with documented fallbacks. Newer unsupported
  versions are **rejected** with a clear German message, never partially read.
- Imports are strict (Zod), treat input as untrusted, render free text as text
  only, run in a single Dexie transaction and roll back fully on any error.
- CSV is export-only; header order and meaning are versioned by test.

| Format                             | Direction               | Name (in content)                   | Version field                           | Version              | Supported imports |
| ---------------------------------- | ----------------------- | ----------------------------------- | --------------------------------------- | -------------------- | ----------------- |
| Full backup                        | export + import         | `app: training-tracker`             | `exportFormatVersion` / `schemaVersion` | format 1 / schema 16 | schema ≤ 16       |
| AI analysis export                 | export                  | (AI export doc)                     | `exportVersion`                         | 1                    | —                 |
| AI response import                 | import                  | `format: training-ai-response`      | `schemaVersion`                         | 1                    | exactly 1         |
| Plan builder kit                   | export                  | `format: training-plan-builder-kit` | `version`                               | 1                    | —                 |
| Training plan package              | export + import + share | `format: training-plan-package`     | `schemaVersion`                         | 1                    | 1                 |
| Block comparison export            | export                  | (comparison doc)                    | —                                       | —                    | —                 |
| CSV (sets/sessions/exercises/body) | export                  | header row                          | header (by test)                        | —                    | —                 |

## Full backup — `src/services/backup.ts`

- Schema: `backupFileSchema`; parser/validator `validateBackupJson`; exporter
  `createBackup`; importer `importBackup` (merge/replace, one transaction).
- Contains every table incl. `templateVersions`, `aiAnalyses`, `equipmentProfiles`,
  `aiExports`, `planImports`, and settings. New tables/fields are added with a
  `.default([])` or optional so older backups still validate. Newer `schemaVersion`
  is rejected.
- Fixtures/tests: `src/services/backup.test.ts` (roundtrip, legacy per version,
  merge/replace, newer-version rejection).

## AI analysis export & response round-trip — `aiExport.ts` / `aiResponse.ts` / `aiApply.ts`

- Export carries `exportId`, `sourceExport {exportId, fingerprint}`,
  `analysisRequest`, `responseContract`, and a `plans` block (only place with
  plan/plan-exercise ids). No workout history ids.
- Response import: strict schema, `schemaVersion` must equal
  `SUPPORTED_RESPONSE_SCHEMA_VERSION`, unknown fields rejected, duplicate
  proposalIds rejected, `expected` must cover every `changes` field (null = unset),
  four-way provenance (valid / missing / unknown / fingerprint-mismatch), atomic
  apply with per-plan restore version. Tests: `aiResponse.test.ts`, `aiApply.test.ts`.

## Training plan package — `src/services/planPackage/*`

- Format `training-plan-package`, schema version 1
  (`src/constants/formats.ts`). One package holds one or more plans plus the
  exercise definitions they reference, using portable keys (`exerciseKey`,
  `planKey`, `planExerciseKey`, `groupKey`) — never internal Dexie ids.
- Schema: `planPackageSchema` (strict Zod). Parser `parsePlanPackage`.
  Exporter `buildPlanPackage`. Import (transactional, conflict-aware)
  `importPlanPackage` with preview `analyzePlanPackageImport`.
- Excludes all private data: no history, past sets/weights, PRs, body data,
  check-ins, AI analyses, settings, internal ids. `includeNotes: false` also
  strips plan/exercise notes before sharing.
- Import never overwrites local data: a same-name compatible exercise is reused,
  an incompatible one is created as a copy, plans are always created new with a
  de-duplicated name. Everything runs in one Dexie transaction (full rollback).
- Duplicate detection: `planImports` (schema store, backup + reset wired) records
  a content `fingerprint`; re-importing the same package is flagged, not blocked.
- Fallbacks: missing optional fields default as documented; unknown muscle
  groups are kept as custom values with a preview warning; newer version rejected.
- Fixtures: `src/services/planPackage/fixtures.ts` (valid current package,
  mutated in tests into invalid / future-version shapes). Tests:
  `planPackage.test.ts` (parse, build roundtrip, analyze, transactional import),
  `builderKit.test.ts`, and UI `src/features/plans/PlanPackageTools.test.tsx`.

## Plan builder kit — `src/services/planPackage/builderKit.ts`

- Format `training-plan-builder-kit`, version 1. A self-describing, data-free
  file handed to ChatGPT so it can produce a valid `training-plan-package`: it
  carries the target contract, the allowed enums (incl. weight-mode-per-tracking
  rules from `exerciseRules.ts`), the muscle-group catalog and a tiny example.
- Export/share only; never imported. The example is validated against the real
  `planPackageSchema` by test so the two can never drift.

## Block comparison export — `src/services/blockComparison.ts`

- `buildBlockComparisonExport`: two blocks + a plain per-week difference, no
  conclusions. Not versioned as an importable format (export/share only).

## CSV — `src/services/csv.ts`

- Export only. `setsCsv`, `sessionsCsv`, `exercisesCsv`, `bodyWeightCsv`. Header
  order/meaning fixed by `src/services/csv.test.ts`. Unknown values stay empty,
  never a fabricated 0.

## Muscle-group catalog — `src/constants/muscleGroups.ts`

Not a file format, but exported inside the builder kit and used by exercise
data. Adding/renaming a catalog entry keeps existing stored strings valid
(canonical German label stored in `primaryMuscleGroup` / `secondaryMuscleGroups`);
unknown stored values are preserved as custom entries.
