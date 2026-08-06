# Format compatibility register

Every importable/exportable file this app produces or reads. **Read this before
any change that could touch a format** (see `AGENTS.md` for the rule). Format
names and versions are centralised in `src/constants/formats.ts` or the format's
own established constant.

**Change gate (#26):** every pull request must record an explicit Format-Impact
decision via `.github/pull_request_template.md`. "Not affected" is only valid
after a real check. A format-relevant change does not merge without an updated
matrix entry here, matching version constants, and roundtrip tests covering the
previous supported version, the current version, an invalid and an
unsupported-future fixture. Raise a schema version only on a real persistence
change; prefer optional/additive fields.

Last full matrix audit (2026-08-06): every version in the table below was
cross-checked against its code constant (`SCHEMA_VERSION` 30, `AI_EXPORT_VERSION`
3, `SUPPORTED_RESPONSE_SCHEMA_VERSION` 2, `PLAN_BUILDER_KIT_VERSION` 3,
`PLAN_PACKAGE_SCHEMA_VERSION` 4 with `SUPPORTED_PLAN_PACKAGE_VERSIONS` [1, 2, 3,
4], `WORKOUT_UNIT_PACKAGE_SCHEMA_VERSION` 2 with
`SUPPORTED_WORKOUT_UNIT_PACKAGE_VERSIONS` [1, 2], `BACKUP_FORMAT_VERSION` 1), and
the backup was confirmed to cover all Dexie stores + settings (guarded by test).

General rules:

- The format name and version live in the file **content**, not just the name.
- Exports always produce the current version. Supported older imports convert
  into the current internal model with documented fallbacks. Newer unsupported
  versions are **rejected** with a clear German message, never partially read.
- Imports are strict (Zod), treat input as untrusted, render free text as text
  only, run in a single Dexie transaction and roll back fully on any error.
- CSV is export-only; header order and meaning are versioned by test.
- **Formats never inherit the display language (#31).** `utils/format` and
  `utils/date` are locale-aware (decimal comma vs point, date order, month
  names), but nothing that leaves the app as a format may use them: `csv.ts`
  keeps its own German label maps and its own `Number(...toFixed())` number
  formatting, and no export service imports `utils/format` at all. The one
  shared constant is `BODY_MEASUREMENT_FIELDS`, whose `label` is part of the
  body CSV header — it therefore stays **canonical German** and must not be
  localised in place; a localised UI label needs a separate lookup.
  `services/exportLanguageIndependence.test.ts` asserts that the same dataset
  produces byte-identical sets/sessions/exercises/body CSV and AI export in
  German and English.
- The label maps that feed the **AI export** (`GROUP_TYPE_LABELS`,
  `PLAN_GOAL_TYPE_LABELS`, `EXPERIENCE_LEVEL_LABELS`, `DELOAD_INTENSITY_LABELS`,
  `SCHEDULE_MODE_LABELS`) are part of that document's content and stay canonical
  German for the same reason. Localising any of them requires splitting the
  export value from the display value first.

| Format                             | Direction               | Name (in content)                       | Version field                           | Version              | Supported imports |
| ---------------------------------- | ----------------------- | --------------------------------------- | --------------------------------------- | -------------------- | ----------------- |
| Full backup                        | export + import         | `app: training-tracker`                 | `exportFormatVersion` / `schemaVersion` | format 1 / schema 30 | schema ≤ 30       |
| AI analysis export                 | export                  | (AI export doc)                         | `exportVersion`                         | 3                    | —                 |
| AI response import                 | import                  | `format: training-ai-response`          | `schemaVersion`                         | 2                    | 1, 2              |
| Plan builder kit                   | export                  | `format: training-plan-builder-kit`     | `version`                               | 3                    | —                 |
| Training plan package              | export + import + share | `format: training-plan-package`         | `schemaVersion`                         | 4                    | 1, 2, 3, 4        |
| Workout unit package               | export + import + share | `format: training-workout-unit-package` | `schemaVersion`                         | 2                    | 1, 2              |
| Block comparison export            | export                  | (comparison doc)                        | —                                       | —                    | —                 |
| CSV (sets/sessions/exercises/body) | export                  | header row                              | header (by test)                        | —                    | —                 |

## Profile fields (schema 30, #46)

- **Schema 30 (additive, no backfill, no index/store change):** `settings` gains
  the optional `displayName` (≤ 60 characters, greeting only) and `birthDate`
  (`JJJJ-MM-TT`). Older settings rows and older backups validate unchanged;
  neither value is ever derived from other data. Backup format stays **1**.
- **The age is never stored.** It is computed from `birthDate` on read
  (`services/profile.ts`), so it cannot go stale in the database, in an old
  backup or in an export.
- **`heightCm` is unchanged** — only its editing surface moved from the settings
  screen to the new profile screen. No field rename, no migration, no semantic
  change.
- **Not affected:** AI export/response contracts, plan/builder/unit packages,
  block comparison, all CSV exports, share cards. The profile values are not
  part of any export; the AI export's `analysisContext` stays what it was.

## Body height + estimated calories (schema 29, #44)

- **Schema 29 (additive, no backfill, no index/store change):** `settings` gains
  the optional `heightCm` (50–280), asked for in onboarding and editable in the
  settings. Older settings rows and older backups validate unchanged (the field
  is optional and never defaulted), and no height is ever derived from other
  data. Backup format stays **1**; a backup written by this version simply
  carries one more optional settings field, and a pre-29 backup restores with no
  height.
- **Body weight is not duplicated:** onboarding writes the entered weight as a
  normal dated `bodyWeightEntry` through the existing repository (one entry per
  day, merge on re-save), so the weight keeps its history and the body-data
  screen, CSV export and backup see it unchanged.
- **Calories stay derived, never persisted:** `services/calories.ts` estimates
  energy per exercise and per session from the recorded sets plus the body
  weight valid _on the day of the session_ (`resolveBodyWeightKg`). Nothing is
  written, so no format carries an estimate, history is never rewritten by a
  later weigh-in, and a corrected set immediately corrects the number. The
  manually recorded cardio value `WorkoutSet.caloriesKcal` keeps its meaning and
  always takes precedence over the model — it is read, never overwritten.
- **Not affected:** AI export/response contracts, plan/builder/unit packages,
  block comparison, all CSV exports, share cards. `AnalyticsDataset` gains an
  optional in-memory `bodyWeightEntries` field; it is not a file format.

## Exerivo rebrand and domain migration (2026-08-02)

- **No persisted schema change:** Dexie stays at schema 28. The database name
  `training-tracker`, existing `training-tracker.*` localStorage keys, record
  ids and relationships remain unchanged so the rebrand cannot orphan data.
- **No wire-format rename:** released content identifiers such as
  `app: training-tracker`, `training-plan-package` and the AI contracts remain
  stable. Rebranding those identifiers would break compatibility and is not a
  UI change.
- **Backup format stays 1:** only the downloaded filename changes from
  `training-backup-...` to `exerivo-backup-...`. The JSON content remains
  byte-structure compatible. Before every merge or replace import, the app now
  downloads an `exerivo-pre-import-backup-...` safety copy using the same
  released backup contract.
- **Origin migration is explicit:** `training-tracker-4xu.pages.dev` and
  `app.exerivo.com` have separate IndexedDB stores. The legacy origin therefore
  remains usable for export through September 2, 2026. The canonical onboarding
  and Settings link to that export path during the time-boxed migration window;
  after the cutoff the legacy client redirects to `app.exerivo.com`.
- AI exports, AI response imports, plan/builder/unit packages, comparison
  exports, shares and CSV headers are not changed by the rebrand.

## Cardio + structured equipment (schema 28)

Cardio is a first-class tracking type kept strictly apart from strength; all
fields are optional and additive, so every older record, backup and package
still reads unchanged and a `duration` (time-based strength hold) exercise is
never reinterpreted as cardio.

- **Schema 28 (additive, no backfill, no index/store change):** `TrackingType`
  gains `cardio`; new `CardioModality` enum; `Equipment` gains cardio devices
  (`treadmill`, `ergometer`, `rowing_machine`, `elliptical`, `stair_climber`,
  `pool`, `jump_rope`). `Exercise.cardioModality`; `SessionExercise` cardio
  snapshots (`cardioModalitySnapshot`, `targetDistanceMetersSnapshot`,
  `targetRpeSnapshot`); `WorkoutSet` cardio metrics (`distanceMeters`,
  `averageHeartRateBpm`, `caloriesKcal`, `elevationGainMeters`, `cadenceRpm`,
  `resistanceLevel`, `cardioModalitySnapshot`); plan/unit items + snapshots gain
  `targetDistanceMeters`/`targetRpe`.
- **Full backup:** roundtrips all cardio via the shared Zod schemas; outer
  `exportFormatVersion` stays **1** (wire contract unchanged), `schemaVersion` is
  **28**. A newer schema is rejected. Old backups (no cardio fields) import.
- **CSV:** cardio columns are **appended** to the sets export (modality,
  distance, a clearly-derived pace/speed, avg heart rate, calories, elevation,
  cadence, resistance) and a modality column to the exercises export; existing
  columns keep order/meaning and strength rows leave the cardio cells blank.
- **Plan package v4 / unit package v2:** carry structured `defaultEquipment` and
  cardio (`cardioModality`, `targetDistanceMeters`/`targetRpe`); older versions
  import with those fields absent (never guessed). Fingerprints cover them.
- **AI export v3:** each set carries `trackingType`; cardio sets add a structured
  `cardio` object with a derived pace; average heart rate only ships on the
  opt-in `includeHeartRate` (default off). **AI response v2:** target proposals
  may change `durationSeconds`/`distanceMeters`/`rpe`; v1 still imports and the
  restore point snapshots the cardio targets. **Builder kit v3** documents the
  cardio tracking type, modalities and structured equipment with a cardio
  example.

## Full backup — `src/services/backup.ts`

- Schema: `backupFileSchema`; parser/validator `validateBackupJson`; exporter
  `createBackup`; importer `importBackup` (merge/replace, one transaction).
- Contains every table incl. `trainingPlans`, `templateVersions`, `aiAnalyses`,
  `equipmentProfiles`, `planSchedules`, `scheduleEntries`, `workoutUnitTemplates`,
  `workoutUnitTemplateExercises`, `aiExports`, `planImports`, and settings. New
  tables/fields are added with a `.default([])` or optional so older backups
  still validate. Newer `schemaVersion` is rejected.
- Workout unit library (schema 19): reusable library units
  (`workoutUnitTemplates`) and their exercises (`workoutUnitTemplateExercises`)
  are their own tables. Plan days gain optional `sourceWorkoutUnitTemplateId` +
  `sourceWorkoutUnitNameSnapshot` (copy-on-add provenance) and sessions optional
  `workoutUnitTemplateId` + `workoutUnitNameSnapshot` (direct start without a
  plan). All optional/defaulted, so a pre-library backup restores with an empty
  library and no migration of existing rows.
- Exercise catalog (schema 20): exercises gain optional `origin`
  (`system`/`custom`), `catalogKey` and `searchTerms`. Absent `origin` is treated
  as `custom`, so pre-catalog backups restore unchanged. The curated system
  catalog is not part of the backup — it is re-seeded idempotently by
  `seedSystemExercises` (keyed by `catalogKey`) on app start and after a reset,
  so importing a backup never duplicates system exercises.
- Plan metadata + usage periods (schema 21): plans gain optional goal/metadata
  fields (goalType, goalText, focusNote, experienceLevel, sessionsPerWeekTarget,
  workingSetsPerWeekTarget, startDate, plannedWeeks, focusMuscleGroups,
  restrictions, targetBodyWeightKg, targetBodyFatPercent). A new
  `planUsagePeriods` store records the spans a plan was active; `settings`
  gains optional `activePlanId`. All optional/defaulted, so older backups
  restore unchanged with no active plan and no usage history.
- Time-boxed deload (schema 22): a new `planDeloadPeriods` store holds 7-day
  deload windows per plan with snapshotted reductions; sessions gain an optional
  `deloadIntensity` marker. Optional/defaulted, so older backups restore with no
  deload history. The legacy plan-level `deloadIntensity` field still validates
  but is inert since Phase 8 (no UI, not applied at session start).
- Session schedule snapshot (schema 23): sessions gain optional
  `scheduleModeSnapshot`, `plannedDate` and `scheduleEntryId`, snapshotted when a
  workout is started from a plan (Phase 4.4). Optional/defaulted, so older
  sessions and backups restore unchanged; they simply lack the schedule context.
- Plan schedule exceptions (schema 25): a new `planScheduleExceptions` store holds
  per-day overrides (`type` `skip` | `rest`, one per plan+date). Optional/defaulted,
  so older backups restore with no exceptions; removed with their plan on delete.
- Move exceptions (schema 26): the exception `type` gains `move` plus an optional
  `movedToDate` (the target day the workout is relocated to). A schema-25 build
  rejects a schema-26 backup as "newer" rather than choking on the unknown enum
  value, which is exactly why the version was bumped.
- Structured equipment + per-set execution (schema 27): exercises gain optional
  `defaultEquipment` (an `Equipment` enum, never guessed from a name); session
  exercises gain optional `equipmentSnapshot`; sets gain optional
  `equipmentSnapshot`, `weightModeSnapshot`, `weightMultiplierSnapshot` and
  `trackingTypeSnapshot`. All optional/defaulted, so older backups restore
  unchanged and a set without its own snapshot resolves its execution
  field-by-field from the session-exercise snapshot (`services/equipment.ts`
  `effectiveSetExecution`). No backfill: absent fields stay absent.
- UI language preference (#31, **no schema bump**): `settings` gains
  `language` (`auto` | `de` | `en`, Zod `.default('auto')`). Additive, purely
  presentational and not indexed, so no Dexie version was raised: an existing
  settings row and every older backup validate unchanged and restore as `auto`
  (guarded by `backup.test.ts`). The preference is exported and restored like the
  other UI settings — a `replace` import merges settings rather than wiping them,
  so restoring an old backup on a device set to English resets the _preference_
  to `auto` and nothing else. No label, enum value, key, unit or stored number is
  ever translated: the same database exports byte-identical domain data in both
  languages (guarded by test). Data keys (`dayKey`/`weekKey`, CSV headers, format
  names) stay language independent by design.
- Support-hint preference (#32, **no schema bump**): `settings` gains optional
  `supportHintLastShownAt` (ISO) and `supportHintDismissed` (boolean). Additive,
  not indexed and purely a UI throttle — no counter of user behaviour, nothing
  transmitted. Older settings rows and backups validate with both absent, which
  means "hint may appear". Deliberate backup/restore behaviour: both travel with
  the backup like the other UI settings, so restoring a device keeps a permanent
  opt-out instead of starting to ask again (guarded by `backup.test.ts`).
- AI import undo (schema 24): `aiAnalyses` gain optional `restoreVersionIds`
  (the `ai-import` `templateVersions` frozen before applying, one per changed
  plan) and `undoneAt` (set when the import was reverted). Optional/defaulted, so
  older analyses restore unchanged and are simply not undoable. The referenced
  restore versions travel with the backup in `templateVersions`.
- Schedule system (schema 18): every plan owns one `PlanSchedule`
  (`free-rotation` | `repeating-cycle` | `weekly`) with `ScheduleEntry` rows for
  the cycle/weekly modes (workout or rest days). Restoring a pre-schedule backup
  gives every plan a default free-rotation schedule inside the same transaction
  (`ensureSchedulesForPlans`, shared with the Dexie v18 upgrade), so the
  suggested rotation is unchanged. Free-rotation stores no entries — its order is
  derived from the plan's days.
- Split system (schema 17): a plan is the parent of one or more days
  (`workoutTemplates`, each with `planId` + `position`). Restoring a pre-split
  backup wraps every orphan day into a single-day plan inside the same
  transaction (`wrapOrphanTemplatesInPlans`, shared with the Dexie v17 upgrade).
  Sessions keep `templateId` (the day) and gain `planId`/`planNameSnapshot`/
  `dayPositionSnapshot`; older sessions without them fall back to the day.
- Fixtures/tests: `src/services/backup.test.ts` (roundtrip, legacy per version,
  merge/replace, newer-version rejection, split round-trip + pre-split restore).
  A structural guard iterates `db.tables` and asserts the backup carries a key for
  every store, mirroring the reset's `ALL_DATA_TABLES` guard — so a newly added
  store cannot be silently dropped from a backup.

## AI analysis export & response round-trip — `aiExport.ts` / `aiResponse.ts` / `aiApply.ts`

- Export carries `exportId`, `sourceExport {exportId, fingerprint}`,
  `analysisRequest`, `responseContract`, and a `plans` block (only place with
  plan/plan-exercise ids). No workout history ids.
- **exportVersion 3 (cardio):** each exported set carries its `trackingType`, and
  a cardio set adds a structured `cardio` object with a clearly-derived pace;
  average heart rate ships only on the opt-in `includeHeartRate` (default off).
  The export states which values are measured and which are derived.
- **exportVersion 2 (Phase 7.1):** added an optional descriptive `trainingContext`
  block (active plan, per-plan goals/metadata, `trainingBlocks` from usage
  periods, `activeDeload`), marks deload sessions with `deloadIntensity` on each
  workout, and adds per-workout `plan`/`workoutUnit` attribution snapshots (name
  at start), each with a data-quality note. Each exported set carries its
  effective `equipment`/`weightMode`/`weightMultiplier` (schema 27) so a dumbbell
  substitution is visible and `totalLoadKg` uses the right convention;
  `personalRecords` entries carry `equipment`/`weightMode` because bests are kept
  apart per execution. All of it is configuration/targets, never
  measurements, and omitted when unset. The export is export-only (no importer
  reads `exportVersion`), so the bump is informational; the response contract and
  its `plans` targets are unchanged. Builder `buildTrainingBlockContext`.
- Response import: strict schema, `schemaVersion` must equal
  `SUPPORTED_RESPONSE_SCHEMA_VERSION`, unknown fields rejected, duplicate
  proposalIds rejected, `expected` must cover every `changes` field (null = unset),
  four-way provenance (valid / missing / unknown / fingerprint-mismatch), atomic
  apply with per-plan restore version whose ids are recorded on the stored
  analysis (`restoreVersionIds`). `undoAiAnalysis` reverts the last import by
  reactivating those restore points and stamping `undoneAt` — a strict one-point
  undo. Tests: `aiResponse.test.ts`, `aiApply.test.ts`.

## Training plan package — `src/services/planPackage/*`

- Format `training-plan-package`, **schema version 4** (`src/constants/formats.ts`;
  `SUPPORTED_PLAN_PACKAGE_VERSIONS = [1, 2, 3, 4]`). One package holds one or more
  plans; each plan has a `splitType`, a list of **days** (each holding its own
  plan-exercises), since v3 an optional **schedule** and since v4 structured
  default equipment and cardio fields. All relationships use portable keys
  (`exerciseKey`, `planKey`, `dayKey`, `planExerciseKey`, `groupKey`) — never
  internal Dexie ids.
- **Schedule (added in schema version 3, carried in v4):** `plan.schedule` carries the mode
  (`free-rotation` | `repeating-cycle` | `weekly`) and ordered `entries`
  (workout entries reference a `dayKey` of the same plan; weekly entries carry a
  `weekday` 0–6; rest entries carry an optional label). free-rotation stores no
  entries. On import the schedule is recreated and entries are re-pointed onto
  the new day ids; a reference that cannot be mapped is dropped, never dangling.
- **Version 3** (no structured equipment/cardio) and **version 2** (also no
  schedule) are still accepted; a v2 file imports with a default free-rotation,
  and the v4-only structured-equipment/cardio fields are simply absent in a v3
  file (never guessed). **Version 1** (a single implicit day, `plan.exercises`)
  is validated against `planPackageSchemaV1` and upgraded (`upgradeV1`) to a plan
  with one day named "Tag A"; the parser reports `migratedFromVersion` and the
  import preview shows a migration note. A newer unknown version is rejected.
- Schema: `planPackageSchema` (strict Zod; `schemaVersion` accepts 2, 3 or 4, all
  share the schema since `schedule` and the structured-equipment/cardio fields
  are optional). Parser `parsePlanPackage`. Exporter `buildPlanPackage` (always
  writes v4, carrying the live schedule, structured default equipment and
  cardio). Import (transactional, conflict-aware) `importPlanPackage` with
  preview `analyzePlanPackageImport`. Each imported plan becomes a `TrainingPlan`
  with its days and schedule.
- Excludes all private data: no history, past sets/weights, PRs, body data,
  check-ins, AI analyses, settings, internal ids. `includeNotes: false` also
  strips plan/exercise notes before sharing.
- **Structured `defaultEquipment` and cardio ARE carried since v4** (behind the
  version bump): `buildPlanPackage` writes an exercise's `defaultEquipment` and
  `cardioModality` when set, and plan-exercises carry `targetDistanceMeters` /
  `targetRpe`. A v1–v3 file has none of these, so a shared exercise from an older
  package still imports with no structured default (→ `unspecified`) and no
  cardio target; the fields are never guessed. The free-text `equipment` string
  continues to travel as before.
- Import never overwrites local data: a same-name compatible exercise is reused,
  an incompatible one is created as a copy, plans are always created new with a
  de-duplicated name. Everything runs in one Dexie transaction (full rollback).
- Duplicate detection: `planImports` (schema store, backup + reset wired) records
  a content `fingerprint`; re-importing the same package is flagged, not blocked.
- Fallbacks: missing optional fields default as documented; unknown muscle
  groups are kept as custom values with a preview warning; newer version rejected.
  A v3 schedule with an unknown `dayKey` (or a weekly entry without a `weekday`)
  is rejected by the strict schema before import.
- Fixtures: `src/services/planPackage/fixtures.ts` (`validPlanPackage` v2 +
  `validPlanPackageV1`, mutated in tests into invalid / future-version shapes).
  Tests: `planPackage.test.ts` (parse, v1 upgrade, invalid v2 cases, build
  roundtrip, analyze, transactional multi-day import), `planSchedulePackage.test.ts`
  (v3 schedule export/roundtrip/rejection), `builderKit.test.ts`, and UI
  `src/features/plans/PlanPackageTools.test.tsx`.

## Workout unit package — `src/services/unitPackage.ts`

- Format `training-workout-unit-package`, **schema version 2**
  (`src/constants/formats.ts`; `SUPPORTED_WORKOUT_UNIT_PACKAGE_VERSIONS = [1, 2]`).
  Carries one or more library workout units, their exercises and target
  values/groups — no plans, history, sets, body data or internal ids. Reuses the
  plan-package exercise/plan-exercise schemas (portable keys only), strict Zod.
  v2 mirrors plan-package v4: structured `defaultEquipment`, `cardioModality` and
  cardio targets (`targetDistanceMeters`/`targetRpe`); a v1 file has none of them
  and imports with those fields absent (never guessed).
- Build `buildWorkoutUnitPackage` (always v2; `includeNotes: false` strips
  exercise/unit notes). Parse `parseWorkoutUnitPackage` (size limit, newer
  version rejected, v1 still accepted, unknown fields rejected, positions must
  reference a defined `exerciseKey`). Import `importWorkoutUnitPackage` in one
  Dexie transaction: a
  same-name compatible exercise is reused, an incompatible one is created as a
  de-duplicated copy; units and their exercises are created new. Existing units,
  plans, sessions and history are never touched.
- Duplicate detection reuses the `planImports` fingerprint ledger
  (`analyzeUnitPackageImport` flags a re-import). Share/download via the same
  `shareJsonExport` fallback as plans. Tests: `src/services/unitPackage.test.ts`
  (build, parse rejection, roundtrip, exercise reuse, duplicate flag).

## Plan builder kit — `src/services/planPackage/builderKit.ts`

- Format `training-plan-builder-kit`, **version 3** (structured equipment +
  cardio). A self-describing, data-free file handed to ChatGPT so it can produce
  a valid `training-plan-package` (schema version 4): it carries the target
  contract, the allowed enums (`splitType`, the `cardioModality` list, plus
  weight-mode-per-tracking rules from `exerciseRules.ts`), the muscle-group
  catalog and a worked example. The example includes an optional `schedule` (a
  `repeating-cycle` with workout and rest entries) and a cardio day with
  structured `defaultEquipment`, `cardioModality` and a cardio target, so a
  kit-built plan can carry a schedule and cardio; omitting `schedule` still
  imports as free-rotation and omitting the cardio fields is valid.
- Export/share only; never imported. The example is validated against the real
  `planPackageSchema` by test so the two can never drift.

## Block comparison export — `src/services/blockComparison.ts`

- `buildBlockComparisonExport`: two blocks + a plain per-week difference, no
  conclusions. Not versioned as an importable format (export/share only).

## CSV — `src/services/csv.ts`

- Export only. `setsCsv`, `sessionsCsv`, `exercisesCsv`, `bodyWeightCsv`. Header
  order/meaning fixed by `src/services/csv.test.ts`. Unknown values stay empty,
  never a fabricated 0.
- New context columns are **appended** (never inserted), so an older parser
  keeps working: `sessionsCsv` gains `Trainingsplan`, `Übungseinheit`, `Deload`
  (ja/nein), `Geplantes Datum`, `Zeitplanmodus`; `setsCsv` gains `Trainingsplan`,
  `Deload` and `Ausrüstung`; `exercisesCsv` gains `Herkunft` (System/Eigene).
  `Deload` reads the session's `deloadIntensity` marker (Phase 5); planned date
  and schedule mode come from the session's Phase-4.4 snapshot fields.
- Equipment/execution (schema 27): `setsCsv`'s existing `Gewichtskonvention` and
  `Gewichtsmultiplikator` columns now report the set's _effective_ execution
  (per-set snapshot → session-exercise snapshot) instead of only the
  session-exercise snapshot — identical for history without per-set data, more
  accurate once a set carries its own execution. The appended `Ausrüstung` column
  holds the structured equipment label (empty for `unspecified`). Header order is
  otherwise unchanged.

## Muscle-group catalog — `src/constants/muscleGroups.ts`

Not a file format, but exported inside the builder kit and used by exercise
data. Adding/renaming a catalog entry keeps existing stored strings valid
(canonical German label stored in `primaryMuscleGroup` / `secondaryMuscleGroups`);
unknown stored values are preserved as custom entries.

## Recorded no-impact decisions

Changes that were checked against this register and deliberately found **not**
format-relevant. Listed so the #26 gate stays auditable.

- **Community links — Ko-fi (#29) and Tally feedback (#30), 2026-07-29.** The
  feature adds only presentation and a typed config of public URLs
  (`src/config/externalLinks.ts`, `src/i18n`, `src/features/community`,
  `PrivacyPage`). Checked and confirmed unaffected: IndexedDB domain data and
  `SCHEMA_VERSION` (no new store, field or migration — no version bump for this
  feature), full backup + restore, AI export / AI response import, plan package,
  workout-unit package, plan builder kit, block-comparison export, all CSV
  exports, share formats, persisted transient state, and every canonical stored
  value (no enum, unit, range or validation rule touched; no stored value is
  translated — localisation is presentation only). No user data of any kind is
  sent to the external services: the entries are plain `target="_blank"` links
  with no query parameters, and nothing is loaded from Tally or Ko-fi at app
  start.
