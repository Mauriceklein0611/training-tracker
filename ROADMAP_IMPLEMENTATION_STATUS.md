# Roadmap-Umsetzungsstatus

Bezug: „Training Tracker zur vollständigen Plan-, Kalender- und Analyse-App
ausbauen" (Opus-Gesamtprompt). Diese Datei ersetzt keine Umsetzung, sondern hält
den geprüften Stand fest.

Zuletzt grüne Pflichtchecks (lokal): `typecheck`, `lint`, `test` (61 Dateien,
682 Tests), `build`, `prettier --check` (geänderte Dateien).

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

### Phase 4 — Plan-Kalender (geplant vs. tatsächlich)

- **Reine Ableitung (`services/planCalendar.ts`):** geplante Tage deterministisch
  aus Zeitplan + Datum, KEINE unbounded Vorab-Erzeugung. repeating-cycle aus
  Anker (`schedule.startDate` bzw. `plan.startDate`), weekly aus Wochentag,
  free-rotation ohne Planüberlagerung. Actual-Ebene aus abgeschlossenen Sessions.
  Status: abgeschlossen/geplant/verpasst/Pause/frei; lokale Kalendertage (kein
  UTC-Slice). Voll getestet.
- **UI (`features/plans/PlanCalendarView.tsx`):** Monatsansicht mit Vor/Zurück,
  farbcodierten Zellen (verpasst nicht strafend), Legende; „Kalender"-Button im
  Plan-Editor.
- **4.4 Session-Snapshots — ERLEDIGT:** aus einem Plan gestartete Trainings
  snapshotten `scheduleModeSnapshot`, `plannedDate`, `scheduleEntryId` (Dexie
  v23, Backup, Format-Doc). Damit CSV `Geplantes Datum`/`Zeitplanmodus`
  freigeschaltet. Frei-Trainings bleiben leer.
- **Offen in Phase 4:** Ausnahmen (verschoben/übersprungen/zusätzliche Pause) als
  eigenes Modell + Aktionen mit Vorschau/Bestätigung.

### Phase 5 — Zeitboxierter 7-Tage-Deload

- **Modell (Dexie v22):** `PlanDeloadPeriod` (Start/Ende = 7 lokale Tage inkl.
  Starttag, Intensität, gesnapshottete Reduktionen Sätze/Dauer/RIR,
  `endedEarlyAt`). `WorkoutSession.deloadIntensity` markiert Deload-Trainings.
  Backup + Reset + Format-Doc.
- **Rechner (`services/deload.ts`, rein):** `DELOAD_DEFAULTS`, `deloadDuration`,
  `deloadEndDate`, `isDeloadActiveOn`, `deloadRemainingDays` — lokale
  Kalendertage, kein Überschreiben der Planwerte.
- **Repo (`db/repositories/planDeload.ts`):** `startDeload` (nur ein aktiver,
  Snapshots), `endDeloadEarly` (Ende auf heute), `getActiveDeload`,
  automatisches Ende durch Datumsablauf.
- **Integration:** `startSessionFromTemplate` nutzt aktiven Deload (Sätze +
  Zieldauer reduziert, Session markiert); alter `deloadIntensity`-Toggle bleibt
  als reiner Satz-Fallback. UI `PlanDeloadCard` (starten/aktiv+Resttage/beenden).
- **Offen in Phase 5:** Gewichtsempfehlungs-Reduktion (es gibt keinen
  gespeicherten Gewichts-Zielwert → nichts erfinden; käme mit Progressions-
  Empfehlung), per-Übung original/effective-Snapshots, Deload-Filter in der
  Analyse (kommt mit Phase 6), Ablösen des Legacy-Toggles (Phase 8).

### Phase 6 — Analyse (Filter-/Vergleichsschicht)

- **Reine Schicht (`services/analysisFilters.ts`):** `DeloadFilter`
  (einbeziehen/ausblenden/nur), `isDeloadSession`, `filterDatasetByDeload`,
  `filterDatasetByPlan`, `restrictDatasetToSessions`, `comparePlans` — alles
  verengt nur das Dataset und ruft die bestehende Engine
  (`computeBlockMetrics`/`computeAnalytics`) auf, KEIN zweiter Motor. Voll
  getestet.
- **UI:** Deload-Filter in AnalyticsPage verdrahtet (bewusster Deload wird nicht
  als Plateau gewertet).
- **Offen in Phase 6:** eigene Analyse-Modus-UI (Plan-Vergleich, Einheiten-
  Vergleich als Screens), Übungseinheiten-Scoping (Session↔Einheit über
  `sourceWorkoutUnitTemplateId`/`workoutUnitTemplateId`), Unsicherheitsanzeige
  bei überlappenden `PlanUsagePeriod`s im Vergleich.

### Phase 7 — Formate (teilweise)

- **7.4 plan-package v3 (Zeitplan) — ERLEDIGT:** Paket trägt jetzt den Zeitplan
  (`plan.schedule`: Modus + Einträge; Workout-Einträge referenzieren `dayKey`,
  weekly `weekday`, Pausen mit Label; free-rotation ohne Einträge). Strikte
  Zod-Validierung (unbekannter dayKey/fehlender weekday → Ablehnung),
  transaktionaler Import (Einträge auf neue Tag-IDs umgemappt, nicht auflösbare
  fallen weg). v2-Dateien importieren als free-rotation, v1 unverändert. Export
  schreibt immer v3; Share-Dialog gibt den Zeitplan mit. Konstanten/Doc/Tests
  aktualisiert (`SUPPORTED_PLAN_PACKAGE_VERSIONS=[1,2,3]`). **Damit ist der
  Phase-A-Rest „Zeitplan im Paket" erledigt.**
- **7.6 Übungseinheiten-Paket — ERLEDIGT:** `training-workout-unit-package`
  (schema 1) in `services/unitPackage.ts` — Build/Parse/Import (strikte Zod,
  Übungs-Reuse-oder-Kopie, transaktional, Dedup über `planImports`-Fingerprint),
  Share/Download-Fallback + Import-Vorschau in der Bibliothek-UI. Tests grün.
- **7.1 KI-Export-Kontext — ERLEDIGT:** `buildAiExport` (jetzt `exportVersion` 2)
  trägt einen beschreibenden `trainingContext`-Block (aktiver Plan, Planziele/
  -metadaten, Trainingsblöcke aus `PlanUsagePeriod`s, aktiver Deload) über die
  reine Funktion `buildTrainingBlockContext`; Deload-Trainings werden je Workout
  mit `deloadIntensity` markiert + Data-Quality-Hinweis, und der Response-Contract
  bittet die KI, Deload-Einheiten nicht als Leistungseinbruch zu werten. Alles
  ist Konfiguration/Vorgabe (keine Messwerte) und wird bei leeren Angaben
  weggelassen. Jedes Training trägt zusätzlich `plan`/`workoutUnit` (der zum
  Start gesnapshottete Plan- bzw. Übungseinheiten-Name) zur Zuordnung; freie
  Trainings tragen keinen. Export-only (kein Parser liest `exportVersion`),
  Contract/`plans`-Ziele unverändert. Format-Register + Tests erweitert. **7.1
  damit abgeschlossen.**
- **7.2 Ein-Punkt-Undo des letzten KI-Imports — ERLEDIGT:** `commitAiAnalysis`
  merkt sich die vor dem Übernehmen erzeugten `ai-import`-Wiederherstellungspunkte
  je Plan als `AiAnalysis.restoreVersionIds`; neue reine Repo-Funktion
  `undoAiAnalysis` reaktiviert sie transaktional (fehlende/gelöschte Pläne werden
  übersprungen, nie dangling) und stempelt `undoneAt` — striktes Ein-Punkt-Undo
  (nur der jüngste Import mit Punkten ist rückgängig machbar). Dexie v24,
  Zod/Backup/Format-Doc erweitert (optional/defaulted). UI: „Import rückgängig
  machen"-Button mit Bestätigungsdialog + „rückgängig gemacht"-Badge in den
  KI-Analysen; die alten „neue Planversion"-Texte auf
  „Wiederherstellungspunkt/rückgängig" umgestellt. Tests grün.
- **7.3 Builder-Kit-Zeitplan — ERLEDIGT:** das Kit-Beispiel trägt jetzt einen
  optionalen `schedule` (repeating-cycle mit Workout- und Pausen-Einträgen), und
  die `rules` erklären alle drei Modi (workout→`dayKey`, rest mit `label`, weekly
  mit `weekday` 0–6, free-rotation ohne Einträge). Beispiel wird weiterhin gegen
  das echte `planPackageSchema` (v3) getestet; neuer Test sichert die Zeitplan-
  Demonstration. Format-Doc aktualisiert.
- **Offen in Phase 7:** weitere Allowlist-Erweiterungen (7.2).

### Phase 8 — Sichtbare Planversionen/Archiv entfernen (teilweise)

- **ERLEDIGT:** Route `/plaene/:templateId/versionen`, Lazy-Import und die Seite
  `TemplateVersionsPage` entfernt; Link „Versionen dieses Tages" aus dem
  Plan-Editor raus. Alter destruktiver Deload-über-Planversionen
  (`activateDeload` + Test) entfernt (durch Phase 5 abgelöst). Keine sichtbare
  Planversions-/Archivhistorie mehr.
- **Bewusst behalten (Übergang, Roadmap erlaubt):** der `templateVersions`-Store
  - `createTemplateVersionWithinTransaction`/`listTemplateVersions` bleiben
    **intern** als KI-Wiederherstellungspunkt (aiApply) und im Backup; nicht mehr
    in der UI. Abgeschlossene Sessions/Snapshots unangetastet.
- **KI-UI-Texte — ERLEDIGT:** die Stellen, die eine KI-Übernahme als „neue
  Planversion"/„neue Version" beschrieben, sprechen jetzt von einem
  „Wiederherstellungspunkt" bzw. „rückgängig machen" (siehe Phase 7.2).
- **Ungenutzte Versions-Repo-Funktionen — ERLEDIGT:** `getTemplateVersion`,
  `setTemplateVersionArchived` und `deleteTemplateVersion` (keine Aufrufer, keine
  Tests) entfernt. `activateTemplateVersion*` bleibt (7.2-Undo),
  `createTemplateVersion*`/`listTemplateVersions`/`snapshotTemplate`/
  `deleteVersionsForTemplate` bleiben (intern/Tests). Das persistierte
  `archived`-Feld bleibt (Backup-Kompatibilität), ist nun aber nur-lesend.

### Phase 9 — CSV-Kontextspalten (teilweise)

- **ERLEDIGT:** `sessionsCsv` +`Trainingsplan`/`Übungseinheit`/`Deload`,
  `setsCsv` +`Trainingsplan`/`Deload`, `exercisesCsv` +`Herkunft` — nur
  angehängt (Header-Reihenfolge stabil), `Deload` aus `session.deloadIntensity`.
  Header-Tests erweitert.
- **Offen in Phase 9:** `geplantes Datum` + `Zeitplanmodus` in Sessions/CSV
  (brauchen die Phase-4.4-Session-Snapshots); vollständiger Format-Impact-Matrix-
  Durchlauf (§9.1) als Abschluss-Audit.

## Offen (nächste Schritte, in Roadmap-Reihenfolge)

- **Phase A Rest (teilweise):** Home **und** die Pläne-Übersicht zeigen bei
  Wochenplänen an, wenn heute ein Pausen-/freier Tag geplant ist („Heute:
  Pause/Frei", aus `state.current`). Offen: Rest-Tage in der Zyklus-/Frei-
  Vorschau (bei diesen Modi ist „heute" nicht kalendergebunden — bewusst offen).
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

Gut machbare nächste Schritte: KI-Analyse-Export um Plan-/Einheiten-/Deload-/
Nutzungszeitraum-Kontext erweitern (7.1); ungenutzte Versions-Repo-Funktionen
(`setTemplateVersionArchived`, `deleteTemplateVersion`) + Tests aufräumen (Phase
8-Rest); Phase-A-Rest (Rest-Tage in Home/Templates-Vorschau); Phase-4-Ausnahmen
(verschoben/übersprungen/zusätzliche Pause); Phase-6-Analyse-Modus-UI. Zum
Abschluss der Format-Impact-Matrix-Durchlauf (§9.1).
