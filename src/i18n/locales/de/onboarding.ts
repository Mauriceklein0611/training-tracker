import type { OnboardingResource } from '@/features/onboarding/model';

export const onboarding: OnboardingResource = {
  dialogTitle: 'Willkommen bei Exerivo',
  progress: 'Schritt {{current}} von {{total}}',
  previous: 'Zurück',
  next: 'Weiter',
  finish: 'Exerivo starten',
  skip: 'Überspringen',
  openImport: 'Backup importieren',
  openPlans: 'Trainingsplan erstellen',
  openGuide: 'Leitfaden öffnen',
  openLegacy: 'Ja, alte App für Backup öffnen',
  continueWithoutLegacy: 'Nein, neu starten',
  migrationDeadline: 'Der Zugriff auf die alte App wird am 2. September 2026 entfernt.',
  steps: [
    {
      id: 'welcome',
      title: 'Train. Track. Evolve.',
      text: 'Exerivo verbindet Krafttraining, Cardio, Planung und lokale Analysen in einer installierbaren App.',
    },
    {
      id: 'local',
      title: 'Deine Daten bleiben bei dir',
      text: 'Trainings- und Körperdaten werden ausschließlich in diesem Browser gespeichert. Es gibt kein Konto und keine Cloud-Datenbank.',
    },
    {
      id: 'backup',
      title: 'Backups sind wichtig',
      text: 'Browserdaten sind an Gerät, Browser und Domain gebunden. Erstelle regelmäßig ein vollständiges Backup.',
    },
    {
      id: 'import',
      title: 'Hast du die alte App schon benutzt?',
      text: 'Öffne die bisherige App einmal, erstelle dort unter Mehr → Daten & Sicherung ein vollständiges Backup und importiere es anschließend hier. Wenn du neu bist, kannst du direkt fortfahren.',
    },
    {
      id: 'plan',
      title: 'Dein erster Plan',
      text: 'Erstelle einen Plan, importiere ein Planpaket oder starte jederzeit ein freies Training.',
    },
    {
      id: 'workout',
      title: 'Im Training schnell bleiben',
      text: 'Vorwerte, Satztypen, RIR/RPE und der Pausentimer helfen beim Erfassen, ohne den Trainingsfluss zu unterbrechen.',
    },
    {
      id: 'guide',
      title: 'Hilfe funktioniert offline',
      text: 'Der integrierte Leitfaden erklärt Installation, Training, Analysen, Deloads und Datensicherung direkt in der App.',
    },
  ],
  migration: {
    title: 'Exerivo ist umgezogen',
    text: 'Erstelle auf dieser alten Adresse zuerst ein vollständiges Backup. Öffne danach app.exerivo.com und importiere die Datei dort. Dieser Migrationszugang endet am 2. September 2026.',
    backup: 'Backup erstellen',
    newApp: 'Neue App öffnen',
  },
};
