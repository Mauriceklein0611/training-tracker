# Roadmap-Umsetzungsstatus

Bezug: „Training Tracker zur vollständigen Plan-, Kalender- und Analyse-App
ausbauen" (Opus-Gesamtprompt). Diese Datei ersetzt keine Umsetzung, sondern hält
den geprüften Stand fest.

Zuletzt grüne Pflichtchecks (lokal): `typecheck`, `lint`, `test` (51 Dateien,
611 Tests), `build`, `prettier --check` (geänderte Dateien), `git diff --check`.

## Abgeschlossen

### Phase A — Zeitplan & Pausentage (Grundlage, war im Arbeitsbaum vorhanden)

`PlanSchedule` + `ScheduleEntry`, Modi `free-rotation` | `repeating-cycle` |
`weekly`, Rest-Days, DB-Schema v18 (`ensureSchedulesForPlans`), reines
Logikmodul `services/schedule.ts`, Repo `db/repositories/schedules.ts`, Backup
erweitert, Editor `features/plans/ScheduleEditor.tsx`. free-rotation speichert
keine Entries (Reihenfolge aus `WorkoutTemplate.position`); nur cycle/weekly
haben Entries. Cursor `cyclePosition` nur für `repeating-cycle`.

### Phase 0 — Kritische Integrationsfehler

- **0.1 Zeitplan-Fortschaltung nach Abschluss.** `finishSession` schaltet den
  Zeitplan jetzt beim Übergang active→completed genau einmal fort. Idempotent
  (zweiter/paralleler Aufruf ist No-op, weil zuerst der Status geprüft wird),
  transaktional (Session-Abschluss und Cursorbewegung committen zusammen). Freie
  Trainings (ohne `planId`) verändern keinen Zeitplan. Nur `repeating-cycle` hat
  einen Cursor; `free-rotation`/`weekly` leiten den nächsten Tag ohne Cursor ab.
  Neue reine Funktion `cursorAfterCompletedWorkout` setzt den Cursor eine
  Position hinter den passenden Zyklus-Eintrag (auch über Pausentage hinweg) und
  lässt ihn bei off-cycle-Einheiten unverändert.
- **0.2 Voller Reset.** `planSchedules` und `scheduleEntries` werden beim
  vollständigen Reset jetzt geleert. Guard-Test iteriert über `db.tables` und
  belegt, dass jede Tabelle außer `settings` (die als Default neu entsteht)
  wirklich geleert wird — so kann keine künftige Tabelle vergessen werden.
- **0.3 „Letztes Training wiederholen".** `startSessionFromPreviousSession`
  überträgt jetzt `planId` (nur bei noch existierendem Plan), `planNameSnapshot`
  und `dayPositionSnapshot`. Kein toter Verweis auf gelöschte Pläne; historische
  Zuordnung und aktueller Zeitplan bleiben getrennt.

**Format-Impact Phase 0:** keine Formatänderung. Genutzte Felder (`cyclePosition`
auf `planSchedules`; `planId`/`planNameSnapshot`/`dayPositionSnapshot` auf
`WorkoutSession`) existierten bereits und laufen bereits durch Backup/CSV. Keine
Enum-, Feld- oder Versionsänderung. Reset betrifft kein Import/Export-Format.

### Phase 1 — Wiederverwendbare Übungseinheiten + Bibliothek

- **1.1 Datenmodell + Repository:** `WorkoutUnitTemplate` +
  `WorkoutUnitTemplateExercise` (eigene Dexie-Stores, Schema v19). Repo
  `db/repositories/workoutUnits.ts`: CRUD, Archivieren, Duplizieren, Übungs-/
  Gruppen-Editing (gleiche Helfer wie Plan-Tage), **Copy-on-add**
  (`addWorkoutUnitToPlan` → eigenständiger Plan-Tag mit Quell-Snapshot),
  `saveTemplateAsWorkoutUnit`. **Direktstart** ohne Plan
  (`startSessionFromWorkoutUnit`, Session-Snapshot Einheit-ID+Name, kein planId).
  Backup + Reset-Registry (mit `db.tables`-Guard) erweitert.
- **1.2 UI:** Bereich „Bibliothek" (`/bibliothek`) mit Segment-Navigation
  Übungseinheiten ⇄ Übungen; Liste mit Zusammenfassung (Übungszahl, Ziel-Sätze,
  Muskel-Chips) und Aktionen Starten / Zu Plan hinzufügen / Bearbeiten /
  Duplizieren / Löschen. Editor `/bibliothek/:unitId` (Name/Beschreibung,
  Übungen mit Zielen + Supersatz/Zirkel-Gruppen). Verlinkt aus „Mehr".
- **1.3:** „Als Übungseinheit in Bibliothek speichern" in der Plan-Tag-Ansicht.

### Phase 2 — System-Übungskatalog

- **2.1/2.2 Modell + Seeding:** `Exercise` erhält `origin` (`system`|`custom`,
  fehlend = custom), stabilen `catalogKey` und `searchTerms`. Katalog
  `constants/exerciseCatalog.ts` (~93 Übungen, alle Muskelgruppen, keine
  Bilder/medizinischen Aussagen). Idempotenter Seeder
  `services/exerciseSeed.ts` (Schlüssel = `catalogKey`: fügt nur Fehlendes
  hinzu, überschreibt nie Nutzeredits, keine Duplikate). Dexie v20 (Indizes
  `origin`/`catalogKey`, bestehende Übungen → `custom`). Seeding beim App-Start
  (`DatabaseGate`, nicht-fatal) und nach vollem Reset (Fresh-Install-Parität).
- **2.3 Suche/Filter:** `filterExercises` durchsucht auch `searchTerms` und
  filtert nach Herkunft; ExercisesPage hat Herkunft-Filter + „System"-Badge.

### Phase 3 — Plan-Metadaten, Ziele, Nutzungszeiträume, Dashboard

- **Modell (Dexie v21):** `TrainingPlan` um optionale Metadaten/Ziele erweitert
  (Zieltyp, Zieltext, Fokusnotiz, Erfahrungsniveau, Einheiten/Woche,
  Arbeitssätze/Woche, Startdatum, geplante Wochen, Fokus-Muskelgruppen,
  Einschränkungen, Zielgewicht/-KFA). Neuer Store `planUsagePeriods`;
  `settings.activePlanId`. Backup + Reset + Format-Doc.
- **Nutzungszeiträume (`db/repositories/planUsage.ts`):** genau ein aktiver
  Plan; `activatePlan` (idempotent, schließt den offenen Zeitraum des
  vorherigen Plans, öffnet neuen), `deactivatePlan`, manuelle Korrektur.
  `deletePlan` schließt den offenen Zeitraum + löscht die Aktiv-Markierung,
  **erhält** aber die Zeiträume (Name-Snapshot). Tests grün.
- **Übersicht (`services/planMetrics.ts`, rein):** Einheiten gesamt, diese Woche
  vs. Ziel, Ø/Woche, Zeitspanne — nur aus abgeschlossenen Sessions abgeleitet,
  nichts erfunden. Kein zweiter Analytics-Motor.
- **UI:** `PlanOverviewCard` (Aktivieren/Deaktivieren + Kennzahlen) und
  `PlanGoalsDialog` (Ziele & Fokus) im Plan-Editor.
- **Offen in Phase 3:** Ziele je Übung + strukturierte Zielerreichung, volle
  Muskelverteilung/Volumen im Dashboard (nutzt später Analytics aus Phase 6),
  eigener Plan-Kalender = Phase 4.

## Offen (nächste Schritte, in Roadmap-Reihenfolge)

- **Phase A Rest:** Trainingsplan-Paket (Sharing) trägt den Zeitplan noch nicht
  mit → bräuchte plan-package v3. Home/Templates zeigen Rest-Tage in der Vorschau
  noch nicht. Übungseinheiten-Paket (Phase 7.6) noch offen.
- **Phase 4** — Zeitplan-Kalender (geplant vs. tatsächlich, Ausnahmen,
  Session-Snapshots `scheduleEntryId`/geplantes Datum).
- **Phase 5** — Zeitboxierter 7-Tage-Deload (ersetzt heutigen
  `deloadIntensity`-Toggle).
- **Phasen 6–8** — Analyse (4 Ebenen), KI-Import/Undo/Formate, Entfernung der
  sichtbaren Planversions-/Archiv-UI.

## Bekannte Risiken / Hinweise

- `createTemplate` (Alt-Pfad für Einzeltag-Pläne) legt einen Plan an, aber keinen
  Schedule-Datensatz. Unkritisch, da `ensureSchedule` fehlende Zeitpläne lazy
  erzeugt; bei Phase 1/3 mitziehen.
- Der Cursor ist bewusst schlicht (Phase A). Wird er in Phase 4 durch die
  kalenderbasierte Ableitung ersetzt, muss der Test in
  `sessionSchedule.test.ts` weiterhin belegen, dass nach einem Abschluss der
  fachlich nächste Zustand erscheint.

### Nächster exakter Schritt

Phase 4 beginnen: eigener Plan-Kalender (geplant vs. tatsächlich). Geplante Tage
aus Zeitplan + Datum ableiten (keine unbounded Vorab-Erzeugung), nur Ausnahmen
(verschoben/übersprungen/zusätzliche Pause) persistieren, Sessions mit geplantem
Datum + Zeitplaneintrag verknüpfen. Erst Ausnahmen-Datenmodell (Dexie v22) + reine
Kalender-Ableitung mit Tests, dann Monats-/Vorschau-UI und Session-Snapshots
(`scheduleEntryId`, geplantes Datum) aus Phase 4.4.
