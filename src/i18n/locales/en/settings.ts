import type { Settings } from '@/i18n/locales/de/settings';

export const settings: Settings = {
  title: 'Settings',
  language: {
    sectionTitle: 'Language',
    label: 'App language',
    hint: 'Automatic follows your device language. Unsupported languages are shown in English. The change takes effect immediately — a running workout is not affected.',
    auto: 'Automatic (system language)',
    de: 'Deutsch',
    en: 'English',
    changed: 'Language changed',
  },
  training: {
    sectionTitle: 'Training',
    restLabel: 'Default rest (seconds)',
    restHint: 'Used whenever an exercise does not define its own rest time.',
    unitLabel: 'Unit',
    unitHint: 'All weights are currently recorded in kilograms.',
    unitKg: 'Kilograms (kg)',
    effortLabel: 'Record effort',
    effortHint:
      'Which effort metric the set editor offers. Optional — a set can always be completed without it.',
    effortRpe: 'RPE (effort)',
    effortRir: 'RIR (reps in reserve)',
    effortNone: 'No entry',
    termsLabel: 'Technical terms',
    termsHint:
      'Beginners see spelled-out labels (e.g. "Effort (RPE)"), experienced users compact ones.',
    termsBeginner: 'Spelled out (beginner)',
    termsExpert: 'Compact (experienced)',
  },
  body: {
    sectionTitle: 'Body data',
    heightLabel: 'Body height (cm)',
    heightHint:
      'Optional and only used to put your figures in context. Leaving it empty is fine.',
    weightHint:
      'Your weight is kept as a dated entry so its history stays intact. Exerivo uses the most recently recorded weight to estimate the calories burned per exercise — an approximation without heart rate.',
    weightLink: 'Record body weight',
  },
  rest: {
    sectionTitle: 'Rest signal',
    soundLabel: 'Sound when the rest is over',
    soundHint:
      'Generated locally. On iPhone the app has to have been touched once beforehand.',
    vibrationLabel: 'Vibration when the rest is over',
    vibrationHint: 'Not supported by every device — iOS browsers ignore vibration.',
    voiceLabel: 'Spoken announcement when the rest ends',
    voiceHint:
      'Announces the end of the rest locally via speech synthesis. On iPhone the app has to have been touched once beforehand.',
    voiceUnsupported:
      'This browser does not support speech synthesis — the setting then has no effect.',
    testSignal: 'Test the signal',
    voiceTest: 'Rest finished.',
  },
  screen: {
    sectionTitle: 'Screen',
    keepAwakeLabel: 'Keep the screen awake during a workout',
    keepAwakeHint: 'Prevents the display from turning off between sets.',
    keepAwakeUnsupported:
      'This browser does not support the feature — the setting then has no effect. The app keeps working normally.',
  },
  appearance: {
    sectionTitle: 'Appearance',
    colorModeLabel: 'Colour mode',
    colorModeHint: 'Dark mode is the default for training indoors.',
    dark: 'Dark (gym mode)',
    light: 'Light',
    system: 'Follow the system setting',
  },
  analytics: {
    sectionTitle: 'Analytics',
    rangeLabel: 'Default range',
    range7d: '7 days',
    range30d: '30 days',
    range90d: '90 days',
    rangeAll: 'All time',
  },
  weeklyGoals: {
    sectionTitle: 'Weekly goals',
    subtitle: 'Shown in the history above the calendar.',
  },
  backupReminder: {
    sectionTitle: 'Backup reminder',
    intervalLabel: 'Reminder interval (days)',
    intervalHint:
      '0 disables the reminder. A backup is the only way to move your data to another device.',
    lastBackup: 'Last backup:',
    never: 'never',
  },
  legacyMigration: {
    sectionTitle: 'Back up data from the old app',
    description:
      'If you used the previous pages.dev app, you can still open it and create a full backup until September 2, 2026.',
    openLegacy: 'Open old app for backup',
  },
  ios: {
    sectionTitle: 'Install on iPhone',
    step1: 'Open this page in Safari.',
    step2: 'Tap "Share" at the bottom.',
    step3: 'Choose "Add to Home Screen".',
    step4: 'From now on, start the app from the home screen icon.',
    note: 'As an installed app the tracker runs full screen and works entirely without an internet connection.',
  },
  about: {
    sectionTitle: 'About Exerivo',
    version: 'Version {{version}}',
    guide: 'Help & guide',
    whatsNew: "What's new?",
    website: 'Exerivo website',
    imprint: 'Legal notice',
    repeatOnboarding: 'Restart onboarding',
  },
};
