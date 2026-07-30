/**
 * Workout-unit library, editor and comparison UI.
 *
 * German is the source of truth. The English resource is typed against this
 * object so missing or misspelled keys fail the typecheck.
 */
export const library = {
  title: 'Bibliothek',
  tabs: {
    units: 'Übungseinheiten',
    exercises: 'Übungen',
  },
  count: {
    exerciseOne: '{{count}} Übung',
    exerciseOther: '{{count}} Übungen',
    unitOne: '{{count}} Einheit',
    unitOther: '{{count}} Einheiten',
  },
  unit: {
    fallbackName: 'Einheit',
    title: 'Übungseinheit',
    create: 'Neue Übungseinheit',
    createAction: 'Übungseinheit anlegen',
    createAndEdit: 'Anlegen und bearbeiten',
    importAction: 'Übungseinheit importieren',
    editAction: '„{{name}}“ bearbeiten',
    edit: 'Einheit bearbeiten',
    duplicateAction: '„{{name}}“ duplizieren',
    duplicated: 'Übungseinheit dupliziert.',
    shareAction: '„{{name}}“ teilen',
    deleteAction: '„{{name}}“ löschen',
    start: 'Starten',
    startNamed: '„{{name}}“ starten',
    startAlreadyRunning: 'Training läuft bereits',
    startFailed: 'Start fehlgeschlagen.',
    addToPlan: 'Zu Plan hinzufügen',
    addedToPlan: 'Zu „{{name}}“ hinzugefügt.',
    empty: {
      title: 'Noch keine Übungseinheiten',
      description:
        'Lege wiederverwendbare Einheiten wie „Push“, „Pull“ oder „Ganzkörper A“ an. Du kannst sie später zu Plänen hinzufügen oder direkt starten.',
    },
    notFound: {
      title: 'Nicht gefunden',
      description: 'Diese Übungseinheit existiert nicht mehr.',
      back: 'Zur Bibliothek',
    },
    delete: {
      title: 'Übungseinheit löschen?',
      description:
        'Die Einheit wird aus der Bibliothek entfernt. Bereits zu Plänen hinzugefügte Kopien und deine Trainingshistorie bleiben unverändert.',
      success: 'Übungseinheit gelöscht.',
    },
  },
  field: {
    name: 'Name',
    description: 'Beschreibung',
    descriptionOptional: 'Beschreibung (optional)',
    namePlaceholder: 'z. B. Push',
  },
  planPicker: {
    title: 'Zu welchem Plan hinzufügen?',
    empty: 'Es gibt noch keinen Trainingsplan.',
    fallbackName: 'Plan',
  },
  import: {
    readFailed: 'Die Datei konnte nicht gelesen werden.',
    unavailableTitle: 'Import nicht möglich',
    confirmTitle: 'Übungseinheiten importieren?',
    success: '{{units}} importiert, {{exercises}} neu.',
    previewUnits: '{{units}}:',
    previewSummary:
      '{{newExercises}} neue Übungen, {{reusedExercises}} werden wiederverwendet. Bestehende Einheiten und deine Historie bleiben unverändert.',
    alreadyImported:
      'Diese Datei wurde bereits importiert. Ein erneuter Import legt Kopien an.',
    confirm: 'Jetzt importieren',
  },
  exercise: {
    add: 'Übung hinzufügen',
    deleted: 'Gelöschte Übung',
    missing: 'Diese Übung existiert nicht mehr.',
    empty: {
      title: 'Noch keine Übungen',
      description:
        'Füge Übungen zu dieser Einheit hinzu. Ziele und Gruppen kannst du danach direkt hier einstellen.',
    },
    moveUp: '{{name}} nach oben',
    moveDown: '{{name}} nach unten',
    remove: '{{name}} entfernen',
    detachGroup: 'Aus Gruppe lösen',
    attachPrevious: 'Mit Übung darüber gruppieren',
  },
  targets: {
    intervals: 'Intervalle',
    sets: 'Sätze',
    intervalRestSeconds: 'Pause zw. Intervallen (s)',
    restSeconds: 'Pause (s)',
    durationSeconds: 'Zieldauer (s)',
    distanceMeters: 'Zieldistanz (m)',
    rpe: 'Ziel-RPE (1–10)',
    repsFrom: 'Wdh. von',
    repsTo: 'Wdh. bis',
    note: 'Notiz',
    optional: 'Optional',
  },
  group: {
    summary: '{{type}} · {{exercises}}',
    typeLabel: 'Gruppentyp',
    type: {
      superset: 'Supersatz',
      circuit: 'Zirkel',
    },
    restLabel: 'Pause',
    rest: {
      round: 'Nach jeder Runde',
      each: 'Nach jeder Übung',
    },
  },
  share: {
    title: 'Übungseinheit teilen',
    systemTitle: 'Übungseinheit „{{name}}“ teilen',
    description:
      '„{{name}}“ mit {{exercises}} wird als portable Datei geteilt. Enthalten sind nur die Einheit, ihre Übungen und Zielwerte — keine Trainingshistorie, keine Körperdaten, keine internen IDs.',
    includeNotes: 'Notizen mitgeben',
    download: 'Herunterladen',
    fallbackHint:
      'Falls Teilen nicht unterstützt wird, lädt die App die Datei stattdessen herunter — du kannst sie dann z. B. über WhatsApp versenden.',
    failed: 'Teilen fehlgeschlagen.',
    saved: 'Datei gespeichert.',
    result: {
      sharedFile: 'Datei wurde zum Teilen übergeben.',
      sharedText: 'Daten wurden als Text zum Teilen übergeben.',
      cancelled: 'Teilen abgebrochen.',
      downloadedCopied:
        'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert und der Inhalt in die Zwischenablage kopiert.',
      downloaded: 'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert.',
      failed: 'Die Datei konnte nicht erzeugt werden.',
    },
  },
  compare: {
    title: 'Einheiten vergleichen',
    subtitle: 'Zwei Bibliotheks-Übungseinheiten nebeneinander',
    empty: {
      title: 'Zu wenige genutzte Einheiten',
      description:
        'Sobald mindestens zwei Übungseinheiten aus deiner Bibliothek trainiert wurden (direkt oder als Plan-Tag), kannst du sie hier vergleichen.',
    },
    units: 'Einheiten',
    unitA: 'Einheit A',
    unitB: 'Einheit B',
    deload: 'Deload',
    deloadOptions: {
      include: 'Deload einbeziehen',
      exclude: 'Deload ausblenden',
      only: 'Nur Deload',
    },
    chooseDifferent: 'Bitte zwei verschiedene Einheiten wählen.',
    calculating: 'Vergleich wird berechnet …',
    weekShort: '{{count}} Wo.',
  },
};

export type Library = typeof library;
