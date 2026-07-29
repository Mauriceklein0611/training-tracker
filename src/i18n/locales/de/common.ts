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
