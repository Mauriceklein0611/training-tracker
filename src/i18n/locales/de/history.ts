export const history = {
  title: 'Verlauf',
  completedCount: '{{count}} abgeschlossene Einheiten',
  search: {
    label: 'Suchen',
    placeholder: 'Training, Übung oder Notiz',
  },
  period: {
    label: 'Zeitraum',
    all: 'Gesamter Zeitraum',
    days7: 'Letzte 7 Tage',
    days30: 'Letzte 30 Tage',
    days90: 'Letzte 90 Tage',
  },
  selectedDay: 'Ausgewählter Tag: {{date}}',
  clearSelection: 'Auswahl aufheben',
  kind: {
    strength: 'Kraft',
    cardio: 'Cardio',
    mixed: 'Kraft + Cardio',
  },
  empty: {
    noWorkouts: 'Noch keine abgeschlossenen Trainings',
    noResults: 'Keine Treffer',
    firstWorkout:
      'Sobald du eine Trainingseinheit beendest, erscheint sie hier — mit allen Sätzen, Pausen und Notizen. Du kannst Einheiten später korrigieren oder als Vorlage für ein neues Training verwenden.',
    selectedDay: 'An diesem Tag gibt es keine Einheit, die zu Suche und Zeitraum passt.',
    filters: 'Passe Suche oder Zeitraum an.',
  },
  calendar: {
    aria: 'Trainingskalender',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    intensityBy: 'Intensität anzeigen nach',
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    metric: {
      sets: 'Sätze',
      sessions: 'Einheiten',
      duration: 'Dauer',
    },
    kind: {
      strength: 'Kraft',
      cardio: 'Cardio',
      mixed: 'Kraft + Cardio',
      deload: 'Deload',
      body: 'Körpermessung',
    },
    sessionOne: '{{count}} Einheit',
    sessionOther: '{{count}} Einheiten',
    setOne: '{{count}} Satz',
    setOther: '{{count}} Sätze',
    bodyDay: '{{date}}: Körpermessung',
    noTraining: '{{date}}: kein Training',
    legend:
      'Farbe = Art des Tages, Sättigung = {{metric}} pro Tag. Ruhetage bleiben grau.',
  },
  goals: {
    title: 'Wochenziele',
    currentWeek: 'Diese Woche',
    progress: '{{label}}: {{actual}} von {{goal}}',
    reached: 'Ziel erreicht',
    remaining: 'Noch {{count}} bis zum Wochenziel',
    finishedProgress: '{{actual}} von {{goal}} in dieser Woche',
    sessions: 'Trainingseinheiten',
    workingSets: 'Arbeitssätze',
    cardioMinutes: 'Cardio-Minuten',
    cardioDistance: 'Cardio-Distanz (km)',
    cardioSessions: 'Cardio-Einheiten',
    exercises: 'Übungen diese Woche',
    exerciseSessions: '{{name}} · Einheiten',
    exerciseSets: '{{name}} · Sätze',
    completedWeeks: 'Abgeschlossene Wochen',
    sessionShort: '{{count}} Einh.',
  },
  detail: {
    pageTitle: 'Trainingseinheit',
    notFound: {
      title: 'Einheit nicht gefunden',
      description: 'Diese Trainingseinheit existiert nicht mehr.',
      back: 'Zurück zum Verlauf',
    },
    start: {
      active: 'Es läuft bereits eine Trainingseinheit.',
      failed: 'Start fehlgeschlagen.',
    },
    edit: {
      aria: 'Einheit bearbeiten',
      name: 'Name der Einheit',
      note: 'Notiz',
      optional: 'Optional',
    },
    exercises: {
      title: 'Übungen und Sätze',
      emptyTitle: 'Keine Übungen erfasst',
      emptyDescription: 'In dieser Einheit wurden keine Sätze gespeichert.',
      noSets: 'Keine Sätze erfasst.',
    },
    action: {
      repeat: 'Neues Training auf dieser Basis',
      duplicate: 'Einheit duplizieren',
      delete: 'Einheit löschen',
    },
    toast: {
      duplicated: 'Einheit dupliziert.',
      deleted: 'Einheit gelöscht.',
    },
    deleteDialog: {
      title: 'Trainingseinheit löschen?',
      description:
        'Alle Sätze und Notizen dieser Einheit werden endgültig gelöscht. Deine Auswertungen ändern sich dadurch sofort.',
      confirm: 'Endgültig löschen',
    },
  },
  setEdit: {
    title: 'Satz {{position}} bearbeiten',
    toast: {
      updated: 'Satz aktualisiert.',
      deleted: 'Satz gelöscht.',
    },
    action: {
      confirmDelete: 'Wirklich löschen',
    },
    field: {
      setType: 'Satzart',
      repetitions: 'Wiederholungen',
      durationSeconds: 'Dauer (s)',
      targetRestSeconds: 'Zielpause (s)',
      actualRestSeconds: 'Tatsächliche Pause (s)',
    },
  },
};

export type History = typeof history;
