import type { OnboardingResource } from '@/features/onboarding/model';

export const onboarding: OnboardingResource = {
  dialogTitle: 'Welcome to Exerivo',
  progress: 'Step {{current}} of {{total}}',
  previous: 'Back',
  next: 'Next',
  finish: 'Start Exerivo',
  skip: 'Skip',
  openImport: 'Import backup',
  openPlans: 'Create training plan',
  openGuide: 'Open guide',
  steps: [
    {
      id: 'welcome',
      title: 'Train. Track. Evolve.',
      text: 'Exerivo combines strength training, cardio, planning and local analytics in one installable app.',
    },
    {
      id: 'local',
      title: 'Your data stays with you',
      text: 'Training and body data is stored only in this browser. There is no account and no cloud database.',
    },
    {
      id: 'backup',
      title: 'Backups matter',
      text: 'Browser data is tied to the device, browser and domain. Create a full backup regularly.',
    },
    {
      id: 'import',
      title: 'Already used the app?',
      text: 'If you used Exerivo at the old pages.dev address, import your full backup here.',
    },
    {
      id: 'plan',
      title: 'Your first plan',
      text: 'Create a plan, import a plan package or start a free workout at any time.',
    },
    {
      id: 'workout',
      title: 'Stay fast in the gym',
      text: 'Previous values, set types, RIR/RPE and the rest timer help you record without breaking your flow.',
    },
    {
      id: 'guide',
      title: 'Help works offline',
      text: 'The built-in guide explains installation, training, analytics, deloads and backups directly in the app.',
    },
  ],
  migration: {
    title: 'Exerivo has moved',
    text: 'Create a full backup at this old address first. Then open app.exerivo.com and import the file there.',
    backup: 'Create backup',
    newApp: 'Open new app',
  },
};
