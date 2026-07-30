/**
 * Shared UI strings: navigation, generic actions, states and units (#31).
 *
 * German is the source of truth. Every other language file declares its object
 * as {@link Common}, so a missing, renamed or misspelled key fails the
 * typecheck instead of silently falling back at runtime.
 */
export const common = {
  appName: 'Training Tracker',
  nav: {
    label: 'Hauptnavigation',
    home: 'Home',
    plans: 'Pläne',
    history: 'Verlauf',
    analytics: 'Analyse',
    more: 'Mehr',
  },
  state: {
    loading: 'Wird geladen …',
    empty: 'Keine Einträge',
    offline: 'Offline',
    error: 'Es ist ein Fehler aufgetreten.',
    noValue: '–',
  },
  action: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    back: 'Zurück',
    close: 'Schließen',
    retry: 'Erneut versuchen',
    confirm: 'Bestätigen',
    edit: 'Bearbeiten',
    share: 'Teilen',
    later: 'Später',
    dismiss: 'Nicht mehr anzeigen',
  },
  external: {
    /** Appended to a link's accessible name so its target is announced. */
    opensInNewTab: 'externer Link, öffnet in neuem Tab',
    offlineHint:
      'Offline nicht verfügbar — dafür ist eine Internetverbindung nötig. Die App selbst funktioniert offline uneingeschränkt weiter.',
  },
  footer: {
    tagline: 'Training Tracker — private, lokale Trainingsdokumentation.',
    privacy: 'Kein Konto, kein Server, keine Übertragung deiner Daten.',
  },
  greeting: {
    morning: 'Guten Morgen',
    day: 'Guten Tag',
    evening: 'Guten Abend',
  },
  relativeDay: {
    today: 'Heute',
    yesterday: 'Gestern',
  },
  /**
   * Count nouns the app repeats everywhere. Explicit singular/plural keys
   * instead of i18next suffix magic, so the typed key check stays exact.
   */
  units: {
    setOne: 'Satz',
    setOther: 'Sätze',
    sectionOne: 'Abschnitt',
    sectionOther: 'Abschnitte',
    reps: 'Wdh.',
  },
  /** Suffixes that qualify a recorded weight in a set summary. */
  setSuffix: {
    perHand: '/Hand',
    assistance: ' Unterst.',
    addedWeight: ' Zusatz',
  },
  validation: {
    number: 'Bitte eine Zahl eingeben.',
    validNumber: 'Bitte eine gültige Zahl eingeben.',
    weightNegative: 'Gewicht darf nicht negativ sein.',
    weightHigh: 'Gewicht wirkt unrealistisch hoch.',
    weightMissing: 'Gewicht fehlt.',
    repsInteger: 'Wiederholungen müssen ganzzahlig sein.',
    repsNegative: 'Wiederholungen dürfen nicht negativ sein.',
    repsHigh: 'Wiederholungen wirken unrealistisch hoch.',
    repsMissing: 'Wiederholungen fehlen.',
    durationNegative: 'Dauer darf nicht negativ sein.',
    durationHigh: 'Dauer wirkt unrealistisch.',
    durationMissing: 'Dauer fehlt.',
    rirRange: 'RIR muss zwischen 0 und 10 liegen.',
    rpeRange: 'RPE muss zwischen 1 und 10 liegen.',
    minimum: '{{field}} muss mindestens {{minimum}} betragen.',
    negative: '{{field}} darf nicht negativ sein.',
    unrealistic: '{{field}} wirkt unrealistisch.',
    nameMissing: 'Bitte gib einen Namen ein.',
    nameLong: 'Der Name ist zu lang (max. 80 Zeichen).',
    nameExists: 'Eine Übung mit diesem Namen existiert bereits.',
    multiplierPositive: 'Der Multiplikator muss größer als 0 sein.',
    multiplierHigh: 'Der Multiplikator wirkt unrealistisch hoch.',
    restRange: 'Die Pause muss zwischen 0 und 3600 Sekunden liegen.',
    field: {
      duration: 'Dauer',
      distance: 'Distanz',
      heartRate: 'Herzfrequenz',
      calories: 'Kalorien',
      elevation: 'Höhenmeter',
      cadence: 'Kadenz',
      resistance: 'Widerstand',
    },
  },
  /** App shell: startup, update banner and the crash fallback. */
  shell: {
    openingDatabase: 'Lokale Datenbank wird geöffnet …',
    storageUnavailableTitle: 'Lokaler Speicher nicht verfügbar',
    storageHintPrivateMode: 'Privaten Modus beenden und die App normal öffnen.',
    storageHintBlocked: 'Prüfen, ob der Browser Websitedaten blockiert.',
    storageHintSpace: 'Genügend freien Speicher auf dem Gerät sicherstellen.',
    crashTitle: 'Es ist ein unerwarteter Fehler aufgetreten',
    crashText:
      'Deine Trainingsdaten sind davon nicht betroffen — sie liegen weiterhin lokal auf diesem Gerät. Du kannst die Ansicht neu laden und normal weiterarbeiten.',
    reloadApp: 'App neu laden',
    updateTitle: 'Neue Version verfügbar',
    updateText: 'Deine Trainingsdaten bleiben beim Aktualisieren vollständig erhalten.',
    updateNow: 'Jetzt aktualisieren',
    updating: 'Wird aktualisiert …',
  },
};

export type Common = typeof common;
