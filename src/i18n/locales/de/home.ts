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
    additionalHeading: 'Weitere Aktionen',
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
    seeAllLabel: 'Alle Trainingspläne ansehen',
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
  /** The active-plan hero: where you are and what to do next. */
  hero: {
    label: 'Aktiver Trainingsplan',
    /** "Woche {{current}} / {{total}}" */
    cycleWeek: 'Woche {{current}} / {{total}}',
    deloadTitle_one: 'Deload aktiv · noch {{count}} Tag',
    deloadTitle_other: 'Deload aktiv · noch {{count}} Tage',
    /** "Zielwerte sind diese Woche um {{percent}} reduziert ({{intensity}}). Bis {{endDate}}." */
    deloadText:
      'Zielwerte sind diese Woche um {{percent}} reduziert ({{intensity}}). Bis {{endDate}}.',
    deloadIntensity: {
      light: 'Leicht (−30 %)',
      medium: 'Mittel (−40 %)',
      strong: 'Stark (−50 %)',
    },
    nextLabel: 'Als Nächstes: ',
    completedToday: 'Heute erledigt',
    tomorrow: 'Morgen',
    inDays: 'In {{count}} Tagen',
    emptyUnit: 'Diese Einheit hat noch keine Übungen.',
    configureUnit: 'Einheit konfigurieren',
    startTraining: 'Training starten',
    noNextUnit: 'Für diesen Plan ist aktuell keine nächste Einheit geplant.',
    /** "Zuletzt: {{name}}" */
    lastUnit: 'Zuletzt: {{name}}',
    /** " · ca. {{minutes}} Min." — appended to the exercise count. */
    estimate: ' · ca. {{minutes}} Min.',
    lastDoneToday: ' · zuletzt heute',
    lastDoneYesterday: ' · zuletzt gestern',
    lastDoneDaysAgo: ' · zuletzt vor {{count}} Tagen',
  },
  /** Counting exercises, used by the hero and the free-workout dialog. */
  exerciseCount_one: '{{count}} Übung',
  exerciseCount_other: '{{count}} Übungen',
  startFreeDialog: {
    title: 'Freies Training starten',
    description:
      'Beginne mit einer leeren Einheit oder starte aus einer gespeicherten Einheit.',
    addYourself: 'Übungen selbst hinzufügen',
    fromLibrary: 'Aus Bibliothek starten',
    emptyLibrary:
      'Noch keine Übungseinheiten in der Bibliothek. Lege welche an, um sie hier direkt zu starten.',
  },
  coachFeed: {
    heading: 'Hinweise',
    why: 'Warum wird das angezeigt?',
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
