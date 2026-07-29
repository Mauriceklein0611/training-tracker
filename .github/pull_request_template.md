<!--
Verpflichtendes Change-Gate (#26). Dieser Abschnitt darf nicht gelöscht werden.
Jede Zeile ist bewusst zu beantworten — leere Kästchen oder eine gelöschte
Checkliste bedeuten "nicht gemerged". Siehe AGENTS.md und
docs/FORMAT_COMPATIBILITY.md.
-->

## Was & warum

<!-- Kurz: was ändert dieser PR und wozu. Verlinke das Issue (z. B. "Closes #NN"). -->

## Format-Impact-Entscheidung (Pflicht)

Genau **eine** Option ankreuzen:

- [ ] **Kein Format betroffen.** Ich habe real geprüft (nicht angenommen), dass
      keine Persistenz-/Import-/Export-/Share-/CSV-/KI-Formate berührt sind.
- [ ] **Formate betroffen.** Details unten sind ausgefüllt und Tests liegen bei.

Eine Änderung ist formatrelevant, sobald sie eines berührt: ein persistiertes
Feld (add/remove/rename/retype/**re-mean**), ein Enum-Wert, Tracking-Typ oder
Weight-Mode, Muskelgruppen-Katalog, Equipment, Progressionswerte, Plan-/
Plan-Item-Felder, Gruppen-/Pausenlogik, Set-/Zielwerte, Check-ins, Körperdaten,
Wochenziele, Analysemetriken, Berechnungssemantik, IDs/Beziehungen,
Fingerprints, Privacy-Optionen, Export-Auswahl, Import-Konflikte, Plan-Versionen,
Einheiten/Ranges oder Validierungsregeln. **Eine semantische Änderung unter
unverändertem Feldnamen ist ebenfalls eine Formatänderung.**

### Nur ausfüllen, wenn "Formate betroffen"

- **Betroffene Formate:** <!-- z. B. Full backup, KI-Export, KI-Antwort-Import, Plan-Paket, Einheiten-Paket, Builder-Kit, CSV, Share -->
- **Schema-/Versions-Impact:** <!-- SCHEMA_VERSION / AI_EXPORT_VERSION / *_PACKAGE_SCHEMA_VERSION etc. — vorher → nachher, oder "unverändert" mit Begründung -->
- **Rückwärtskompatibilität:** <!-- Wie lesen alte Daten/Backups/Pakete weiter? Neue Felder optional/additiv? Fallbacks für fehlende Felder? -->
- **Migration:** <!-- Braucht Dexie eine neue additive Version? Kein Backfill, der rät. Transaktional & deterministisch. -->

Bestätigen (nur bei betroffenen Formaten):

- [ ] `docs/FORMAT_COMPATIBILITY.md` und die Versionskonstanten in
      `src/constants/formats.ts` sind aktualisiert und stimmen überein.
- [ ] Die Bedeutung einer bereits veröffentlichten Version wurde **nicht**
      geändert; Exporte erzeugen die aktuelle Version.
- [ ] Ältere unterstützte Importe konvertieren mit dokumentierten, nicht
      erfundenen Fallbacks; neuere unbekannte Versionen werden mit klarer
      deutscher Meldung abgelehnt (nie teilweise gelesen).
- [ ] Roundtrip-/Store-Coverage-Tests decken vorherige unterstützte Version,
      aktuelle Version, absichtlich ungültige und unsupported-future ab und sind
      grün.

## Daten-Kompatibilität (bei jeder datenrelevanten Änderung)

- [ ] Bestehende Zeilen werden weiter gelesen (alte Records ohne neue Felder
      werden nicht von Zod verworfen; neue persistierte Felder optional/defaulted).
- [ ] IDs und Beziehungen bleiben erhalten (keine neuen IDs für bestehende Zeilen).
- [ ] Laufende Trainings bleiben nutzbar, abgeschlossene historisch korrekt
      (History nie aus Live-Stammdaten neu berechnen).
- [ ] Kein Reset / kein Droppen von Tabellen / kein Verwerfen ungültiger Zeilen
      als Migrationspfad (siehe AGENTS.md).

## Qualitäts-Gate (lokal nachgewiesen grün)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npx prettier --check` auf den geänderten Dateien

## Sonstiges

- [ ] Mobile Kernabläufe manuell geprüft (soweit UI betroffen).
- [ ] Doku aktualisiert; keine unbestätigten Testbehauptungen.
