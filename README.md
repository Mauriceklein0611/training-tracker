# Training Tracker

A private, offline-first strength **and cardio** training tracker, built as an
installable Progressive Web App for a single user on a single phone.

There is no account, no backend, no sync and no analytics. Every workout you
record stays in the browser's local database on the device you recorded it on.

The user interface is entirely in German; the source code and this documentation
are in English.

---

## Table of contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology](#technology)
4. [Local installation](#local-installation)
5. [npm scripts](#npm-scripts)
6. [Data model](#data-model)
7. [Local storage](#local-storage)
8. [Backup and restore](#backup-and-restore)
9. [AI analysis export](#ai-analysis-export)
10. [CSV export](#csv-export)
11. [Installing on iPhone](#installing-on-iphone)
12. [Deployment on Cloudflare Pages](#deployment-on-cloudflare-pages)
13. [Privacy](#privacy)
14. [Testing](#testing)
15. [Known limitations](#known-limitations)

---

## Overview

The app covers a full training loop:

- **Exercises** — a curated library of common exercises is seeded on first start
  (re-seeded idempotently, so it never duplicates), and you can add your own
  alongside them. For each exercise you decide how it is tracked (weight,
  bodyweight, assisted, reps only, time or **cardio**), its muscle groups, its
  default equipment, and — for cardio — its modality (running, cycling, rowing,
  swimming …). Your own exercises and the system ones stay clearly distinguished.
- **Plans** — reusable workout units and multi-day split plans with target sets,
  target rep ranges, per-exercise rest times and, for cardio, target duration,
  distance and RPE. Reorderable with buttons _and_ drag and drop, with an
  optional weekly / rotating / cycle schedule and time-boxed deload weeks.
- **Free workouts** — start without a plan and add exercises as you go, including
  creating a brand-new exercise mid-workout; a free cardio session is one tap.
- **Live view** — the screen you actually use in the gym: large touch targets,
  numeric keypads, the previous performance as a suggestion, a rest timer that
  survives a locked screen, and a dedicated cardio section with a timer, live
  pace/speed and RPE.
- **History** — a diary grouped by day, searchable, with after-the-fact
  corrections that update every statistic immediately.
- **Analytics** — frequency, volume, sets per muscle group, progression per
  exercise, estimated 1RM and rest discipline for strength; duration, distance,
  pace/speed and personal bests for cardio; plus streaks and time-block, plan and
  workout-unit comparisons — all computed locally.
- **Body data** — an optional daily diary of weight, body fat percentage and
  thirteen circumference measurements.
- **Data & backup** — full JSON backup and restore, a curated export for a
  language model, and CSV exports.

### Design principles

Two rules shaped most of the implementation:

**Never invent a number.** Kilogram volume is only computed where it is
physically meaningful. A TRX row or a plank is never assigned a fabricated
kilogram volume — the value is `null`, and the UI shows `–`. The estimated 1RM
is always labelled as an estimate and is only calculated for weighted exercises
inside a 1–12 repetition window.

**Never lose a set.** Every input is written to IndexedDB immediately, rest is
anchored to absolute timestamps rather than a ticking counter, destructive
actions are confirmed, imports run in a single transaction, and a service worker
update cannot touch the database.

---

## Architecture

Fully client-side single-page application. No server code exists anywhere in the
project.

```
src/
├── components/        Generic UI: buttons, fields, dialogs, layout, error boundary
│   ├── layout/        App shell, bottom navigation, page header
│   └── ui/            Accessible primitives (no component library is fetched)
├── features/          Feature-specific composition
│   ├── analytics/     Chart components
│   ├── exercises/     Exercise form and picker dialogs
│   ├── history/       Correcting a past set
│   └── session/       Live view: set editor, rest timer, summary
├── pages/             One file per route, lazily loaded
├── db/                Dexie database, schema, migrations, Zod entity schemas
│   └── repositories/  All database access lives here — no queries in components
├── services/          Domain logic: metrics, analytics, rest, backup, exports, PWA
├── hooks/             Reusable React hooks
├── types/             Central TypeScript types
├── utils/             Small helpers (dates, formatting, ids, downloads)
└── tests/             Test factories, helpers and integration tests
```

### Layering rules

- **Components never query the database.** They call a repository in
  `src/db/repositories/`.
- **Components never calculate.** Volume, 1RM, rest deviation, aggregation and
  record detection are pure functions in `src/services/`, which is what makes
  them unit-testable.
- **Snapshots protect history.** When an exercise enters a workout, its name,
  tracking type, weight mode and multiplier are copied into the
  `SessionExercise`. Renaming or archiving an exercise later never rewrites past
  workouts.

---

## Technology

| Concern    | Choice                                                              |
| ---------- | ------------------------------------------------------------------- |
| Framework  | React 18 + TypeScript 5.7                                           |
| Build      | Vite 6                                                              |
| Styling    | Tailwind CSS 4 (`@tailwindcss/vite`), system fonts only             |
| Components | Hand-built accessible primitives (native `<dialog>`, semantic HTML) |
| Database   | Dexie 4 over IndexedDB, `dexie-react-hooks` for live queries        |
| Routing    | React Router 6 with lazy-loaded routes                              |
| Charts     | Recharts (loaded only on the analytics page)                        |
| Validation | Zod (import files and entity schemas)                               |
| Dates      | date-fns with the German locale                                     |
| PWA        | vite-plugin-pwa (Workbox `generateSW`)                              |
| Testing    | Vitest, React Testing Library, fake-indexeddb                       |
| Quality    | ESLint 9 (flat config), Prettier                                    |

Nothing is loaded from a CDN at runtime. No web fonts are fetched. No external
API is called.

---

## Local installation

Requires Node.js 20 or newer.

```bash
git clone <your-repository-url>
cd training-tracker
npm install
npm run dev
```

The dev server prints a local URL (default `http://localhost:5173`).

To test the installable app and offline behaviour you need a production build,
because the service worker is not active in dev mode:

```bash
npm run build
npm run preview
```

---

## npm scripts

| Script               | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Development server with hot reloading                           |
| `npm run build`      | Type-checks and produces the production build in `dist/`        |
| `npm run preview`    | Serves the production build locally                             |
| `npm run typecheck`  | TypeScript, no emit                                             |
| `npm run lint`       | ESLint over the whole project                                   |
| `npm run format`     | Prettier, writing changes                                       |
| `npm run test`       | Full test suite, once                                           |
| `npm run test:watch` | Tests in watch mode                                             |
| `npm run icons`      | Regenerates the PWA PNG icons from `scripts/generate-icons.mjs` |

---

## Data model

All timestamps are ISO-8601 strings; all ids are UUIDs; every record carries
`createdAt` and `updatedAt`.

### Exercise

| Field              | Notes                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| `trackingType`     | `weight_reps`, `bodyweight_reps`, `assisted_bodyweight_reps`, `reps_only`, `duration` |
| `weightMode`       | `per_hand`, `total`, `added_weight`, `assistance`, `none`                             |
| `weightMultiplier` | Factor for volume. Two 20 kg dumbbells → multiplier `2` → 40 kg total load            |
| `archived`         | Archived exercises stay in history but disappear from pickers                         |

An exercise that appears in any recorded workout **cannot be deleted** — the app
requires archiving it instead, so history stays intact.

### WorkoutTemplate / TemplateExercise

A plan and its ordered exercises, with `targetSets`, `targetRepMin`,
`targetRepMax`, `targetDurationSeconds` and `restSeconds`.

### WorkoutSession

`status` is `active` or `completed`. **At most one session may be active at a
time**; starting another one is rejected and the app navigates to the running
workout instead. On startup an active session is detected and offered for
resumption.

### SessionExercise

Contains `exerciseNameSnapshot`, `trackingTypeSnapshot`, `weightModeSnapshot`
and `weightMultiplierSnapshot` — the frozen configuration described above.

### WorkoutSet

`setType` is `warmup`, `working`, `drop` or `failure`. Rest is stored as
`restTargetSeconds`, `restStartedAt`, `restEndedAt` and `restActualSeconds`.
A cardio set instead carries raw cardio metrics — `distanceMeters`,
`averageHeartRateBpm`, `caloriesKcal`, `elevationGainMeters`, `cadenceRpm`,
`resistanceLevel` and a `cardioModalitySnapshot` — all optional; pace and speed
are always derived from duration and distance, never stored.

Validation: weight not negative, reps whole numbers, RIR 0–10, RPE 1–10,
durations and distances not negative, and the required fields follow the
tracking type.

### BodyWeightEntry — body data

Optional diary, one entry per day, holding:

- `weightKg` — body weight
- `bodyFatPercent` — body fat percentage
- `measurements` — circumferences in centimetres: neck, shoulders, chest, waist,
  hip, biceps, forearms, thighs and calves, each split into left and right where
  that matters, so imbalances stay visible

Every field is individually optional; an entry only has to carry **at least one**
value, so you can log a weigh-in in the morning and add measurements in the
evening. Saving the same date again **merges** into the existing entry rather
than replacing it, so a later measurement never wipes the morning's weight.

None of this is used to fabricate a kilogram volume for bodyweight exercises.

### AppSettings

Single row: unit (`kg`), default rest, default analytics range, theme, rest
sound, rest vibration, backup reminder interval, last backup timestamp and the
database schema version.

### Calculation rules

- **Volume** = total load × reps, only for `weight_reps`. Everything else yields
  `null`.
- **Total load** applies `weightMultiplier` for `per_hand`.
- **Added weight** on bodyweight sets is reported separately, never mixed into
  barbell volume.
- **Estimated 1RM** uses Epley: `load × (1 + reps / 30)`, restricted to 1–12
  repetitions and weighted exercises, always labelled as an estimate.
- **Warm-up sets** are excluded from working volume, records and 1RM by default.
- **Cardio** is kept strictly apart from strength: it is never added to kilogram
  volume or working-set counts. Pace/speed follow the modality's convention
  (min/km, /500 m, km/h …) and are only computed when both duration and distance
  are present; a cross-modality aggregate pace is never invented.

---

## Local storage

Training data lives exclusively in **IndexedDB** (database name
`training-tracker`), accessed through Dexie. `localStorage` is used for exactly
one thing: remembering the theme so the first paint is not a bright flash.

The schema is versioned, and every version is documented in `MIGRATIONS` in
[`src/db/db.ts`](src/db/db.ts) and shown in the app under
_Mehr → Lokale Speicherung_. Migrations are covered by tests that assert no data
is lost across an upgrade.

### Persistent storage

On first launch the app calls `navigator.storage.persist()`. Under
_Mehr → Lokale Speicherung_ you can see:

- whether persistent storage was granted (`navigator.storage.persisted()`),
- roughly how much space is used (`navigator.storage.estimate()`),
- when the last backup was exported.

All three calls are optional: if the Storage API is missing the app explains the
situation and keeps working.

---

## Backup and restore

Under _Mehr → Daten & Sicherung_.

### Creating a backup

"Vollständige Sicherung erstellen" writes
`training-backup-YYYY-MM-DD.json` containing the export format version, the
database schema version, the export timestamp, settings, exercises, templates,
template exercises, sessions, session exercises, sets and body data entries.

### Restoring a backup

1. Pick the file.
2. It is validated with Zod; the export version is checked.
3. A preview shows the record count per table, plus warnings (orphaned records,
   several active sessions).
4. An invalid file is rejected with a readable explanation and nothing is
   written.
5. You choose:
   - **Zusammenführen (merge)** — adds only records whose UUID is not present
     yet. Local records always win on conflict, so a merge can never overwrite
     newer local data.
   - **Ersetzen (replace)** — wipes all training data first. This requires an
     extra explicit confirmation.
6. The import runs inside a **single Dexie transaction**. If anything fails,
   nothing is written and the previous database is untouched.

---

## AI analysis export

A separate, deliberately different export from the technical backup. It is
_self-describing_, so a language model does not have to guess at conventions.

You choose the period (all / 30 days / 90 days / custom) and whether to include
notes, body data (weight, body fat, measurements) and warm-up sets. **The file
contains only what you selected** — a test asserts that unselected measurements
do not appear anywhere in the output.

`training-ai-export-YYYY-MM-DD.json` includes `exportVersion`, `generatedAt`,
the selected period, units, an explanation of every weight convention and
tracking type, summary figures, muscle group load, weekly totals, rest analysis,
the exercise catalogue, personal records, the workouts with their sets in
chronological order, computed volume where meaningful, marked personal bests, and
a data-quality section listing what is missing.

Internal UUIDs are stripped — exercises are identified by name — while the
relationships stay unambiguous.

### Analysis instruction

"Analyseanweisung kopieren" copies a ready-made German prompt that asks for
frequency, per-exercise progression, weekly volume per muscle group, rest
discipline, plateaus and drops, tells the model to distinguish weighted,
bodyweight, TRX and timed exercises, and explicitly forbids inventing missing
values or judging unweighted exercises by a fictional kilogram volume.

The file is created locally. It only leaves your device if you upload it
yourself.

---

## CSV export

Four UTF-8 files (with BOM, CRLF line endings, RFC 4180 quoting):

- **Sätze** — date, workout, exercise, muscle group, equipment, tracking type,
  set number, set type, weight, weight convention, weight multiplier, reps,
  duration, RIR, RPE, target rest, actual rest, rest deviation, computed volume,
  note.
- **Trainingseinheiten**, **Übungen**.
- **Körperdaten** — date, weight, body fat and one column per circumference.
  Unmeasured values stay empty cells rather than zeros.

---

## Installing on iPhone

1. Open the deployed URL in **Safari** (not Chrome — only Safari can install a
   PWA on iOS).
2. Tap **Teilen** (the share icon).
3. Choose **Zum Home-Bildschirm**.
4. Launch the app from the home screen icon from then on.

It then runs full screen, works entirely offline after the first load, and keeps
its own database.

The app shows these steps under _Einstellungen_ when it detects iOS outside
standalone mode.

### Notes for iOS

- The rest tone uses the Web Audio API and is unlocked by your first tap in the
  app; a set completion counts, so the timer beep works from then on.
- Vibration is not supported by any iOS browser — the app simply skips it.

---

## Deployment on Cloudflare Pages

1. Create a **private** repository on GitHub.
2. Push this project to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin main
   ```
3. In the Cloudflare dashboard open **Workers & Pages → Create → Pages →
   Connect to Git**.
4. Authorise GitHub and select your private repository.
5. Build settings:
   - Framework preset: **None** (or Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - No environment variables, no secrets, no server functions.
6. Deploy.
7. Open the resulting `https://<project>.pages.dev` URL in Safari on the iPhone.
8. Add it to the home screen as described above.

### Included configuration

- **SPA routing needs no configuration.** Cloudflare Pages already serves
  `index.html` for any path that does not match a file, so a direct hit on
  `/analyse` or `/verlauf/<id>` resolves. A Netlify-style
  `/* /index.html 200` rule is _not_ wanted here — Pages rejects it as an
  infinite loop and ignores it.
- [`public/_headers`](public/_headers) — a strict CSP locked to `'self'`
  (`connect-src 'self'` blocks outgoing requests), `nosniff`, `no-referrer`,
  `frame-ancestors 'none'`, plus cache rules: hashed assets immutable, while
  `sw.js`, `workbox-*.js`, `index.html` and the manifest are never cached
  long-term so updates are always picked up.

### Updates

The service worker uses `registerType: 'prompt'`. A new deployment shows a
banner; you decide when to reload, so an update never interrupts a set.
**Updates never touch IndexedDB** — the worker only caches the app shell.

---

## Privacy

- All data is stored exclusively on this device, in this browser.
- No transmission to any server; no backend exists.
- No user account, no registration.
- No cookies, no tracking, no telemetry, no ads.
- No external fonts, scripts or APIs at runtime.
- Clearing browser site data — or deleting the installed app — can remove your
  training history. Take backups.
- The AI export is generated locally and only shared if you share it.

The same information is in the app under _Mehr → Datenschutz_.

---

## Testing

```bash
npm run test
```

A broad unit and component suite runs with Vitest (`npm run test` prints the
current count). IndexedDB is mocked with `fake-indexeddb`; the real app always
uses the browser's IndexedDB.

**Unit tests** cover volume calculation, the weight multiplier, estimated 1RM,
muscle group evaluation, rest evaluation, cardio metrics (pace/speed, records)
and cardio-vs-strength separation, date and week aggregation, backup export,
backup validation, merge import, replace import, transactional rollback, the AI
export/response round-trip, the plan and workout-unit packages, CSV escaping,
input validation and schema migrations.

**Integration tests** cover the central flows: create an exercise → create a
plan → start a workout → complete a set → end the rest → finish the workout →
open it in the history → see the analysis update → export a backup → import it
again. Two React Testing Library suites drive the real live-workout and exercise
screens against a real in-memory database.

Specifically verified:

- The rest timer is derived from absolute timestamps — a test advances the clock
  by five minutes across a simulated app restart and asserts the elapsed time is
  still exact.
- An interrupted workout is recovered, and only one workout can be active.
- A renamed exercise does not rewrite past workouts.
- An exercise that has been trained cannot be deleted.
- A failed import leaves the database completely unchanged.

---

## Known limitations

- **No synchronisation between devices.** None is planned — it would require a
  server.
- **Moving to another device means exporting a backup and importing it there.**
  This is the only supported transfer path.
- **Every browser has its own separate database.** Safari and Chrome on the same
  phone do not share data, and neither does the installed app versus a browser
  tab in some configurations.
- **The publicly reachable app contains no shared user data.** Anyone opening the
  URL gets an empty database of their own.
- **Regular backups are necessary.** Browsers may evict site data, and clearing
  browsing data removes the history. The app reminds you when a backup is
  overdue.
- Weights are kilograms only; there is no pounds mode.
- The estimated 1RM is a formula, not a measurement, and is meaningless outside
  1–12 repetitions.
- Bodyweight exercises are not converted into a kilogram volume, by design. This
  means total volume understates the work done in a bodyweight-heavy program;
  sets and repetitions are the metric to watch there.
- Drag and drop for reordering is pointer-based; the up/down buttons are the
  accessible and touch-reliable path and are always available.
