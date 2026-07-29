/** Home screen: starting a workout is the one thing that matters here (#31). */
export const home = {
  activeSession: {
    title: 'Laufende Trainingseinheit',
    /** "{{name}} · gestartet {{startedAt}}" */
    subtitle: '{{name}} · gestartet {{startedAt}}',
    resume: 'Training fortsetzen',
  },
  noActivePlan: {
    title: 'Kein aktiver Trainingsplan',
    withPlans:
      'Aktiviere einen Plan, damit dein Homescreen dir die nächste Einheit und den Zyklus zeigt.',
    withoutPlans: 'Erstelle oder importiere einen Plan — oder trainiere gleich frei.',
    activate: 'Plan aktivieren',
    create: 'Plan erstellen',
    import: 'Trainingsplan importieren',
  },
  backupOverdue: {
    title: 'Sicherung überfällig',
    /** "Letzte Sicherung: {{date}}." */
    last: 'Letzte Sicherung: {{date}}.',
    never: 'Es wurde noch nie eine Sicherung erstellt.',
    cta: 'Jetzt Backup erstellen →',
  },
  start: {
    heading: 'Training starten',
    free: 'Freies Training starten',
    cardio: 'Cardio starten',
    repeatLast: 'Letztes Training wiederholen',
    /** "„{{name}}“ erneut starten" */
    repeatNamed: '„{{name}}“ erneut starten',
    noExercises:
      'Du hast noch keine Übungen angelegt. Du kannst sie auch direkt während des Trainings erstellen.',
  },
  plans: {
    heading: 'Trainingspläne',
    seeAll: 'Alle ansehen',
    emptyTitle: 'Noch keine Trainingspläne',
    emptyDescription:
      'Lege einen Plan an, um wiederkehrende Trainings mit festen Übungen, Ziel-Sätzen und Pausenzeiten zu starten. Für spontane Einheiten reicht das freie Training.',
    startEntry: 'Starten',
    /** "Heute: {{name}}" — a scheduled rest or free day. */
    today: 'Heute: {{name}}',
    /** "Als Nächstes: {{name}}" — the next unit of a multi-day plan. */
    next: 'Als Nächstes: {{name}}',
  },
  overview: {
    heading: 'Überblick',
    emptyTitle: 'Noch keine Trainingsdaten',
    emptyDescription:
      'Sobald du deine erste Einheit abgeschlossen hast, erscheinen hier deine Wochenübersicht und die wichtigsten Kennzahlen. Alle Auswertungen entstehen ausschließlich aus deinen lokalen Daten.',
    thisWeek: 'Diese Woche',
    thisWeekHint: 'Trainingseinheiten',
    streak: 'Serie',
    streakHint: 'Wochen in Folge',
    workingSetsWeek: 'Arbeitssätze Wo.',
    cardioWeek: 'Cardio Wo.',
    hintThisWeek: 'diese Woche',
    days30: '30 Tage',
    days30Hint: 'Einheiten',
    volume30: 'Volumen 30 T.',
    volume30Hint: 'gewichtete Übungen',
    lastSession: 'Letzte Einheit',
  },
  importDialog: {
    title: 'Trainingsplan importieren',
    description:
      'Importiere ein geteiltes Trainingsplan-Paket oder eine KI-Datei. Hast du noch keine? Lass dir zuerst mit der KI einen Plan erstellen. Beim Import wird nichts überschrieben.',
  },
  errors: {
    sessionAlreadyRunning: 'Es läuft bereits eine Trainingseinheit.',
    startFailed: 'Start fehlgeschlagen.',
  },
};

export type Home = typeof home;
