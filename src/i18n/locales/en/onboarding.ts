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
  openLegacy: 'Yes, open the old app for backup',
  continueWithoutLegacy: 'No, start fresh',
  migrationDeadline: 'Access to the old app will be removed on September 2, 2026.',
  profile: {
    heightLabel: 'Height (cm)',
    weightLabel: 'Weight (kg)',
    hint: 'Both are optional and stay on this device. You can change them any time in the settings and under body data.',
    invalidHeight: 'Please enter a height between 50 and 280 cm.',
    invalidWeight: 'Please enter a weight between 20 and 500 kg.',
  },
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
      title: 'Have you used the old app before?',
      text: 'Open the previous app once, create a full backup under Explore → Data & backup, then import it here. If you are new, you can continue right away.',
    },
    {
      id: 'profile',
      title: 'Your body data',
      text: 'Height and weight help put your progress in context. Exerivo also uses your weight to estimate the calories burned per exercise — an approximation without heart rate, not a measurement.',
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
    text: 'Create a full backup at this old address first. Then open app.exerivo.com and import the file there. This migration access ends on September 2, 2026.',
    backup: 'Create backup',
    newApp: 'Open new app',
  },
};
