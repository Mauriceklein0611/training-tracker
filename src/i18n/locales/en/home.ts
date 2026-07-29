import type { Home } from '@/i18n/locales/de/home';

export const home: Home = {
  activeSession: {
    title: 'Workout in progress',
    subtitle: '{{name}} · started {{startedAt}}',
    resume: 'Resume workout',
  },
  noActivePlan: {
    title: 'No active training plan',
    withPlans:
      'Activate a plan so your home screen shows the next workout and where you are in the cycle.',
    withoutPlans: 'Create or import a plan — or just train freely.',
    activate: 'Activate plan',
    create: 'Create plan',
    import: 'Import training plan',
  },
  backupOverdue: {
    title: 'Backup overdue',
    last: 'Last backup: {{date}}.',
    never: 'No backup has ever been created.',
    cta: 'Create a backup now →',
  },
  start: {
    heading: 'Start a workout',
    free: 'Start a free workout',
    cardio: 'Start cardio',
    repeatLast: 'Repeat the last workout',
    repeatNamed: 'Start "{{name}}" again',
    noExercises:
      'You have not created any exercises yet. You can also create them while training.',
  },
  plans: {
    heading: 'Training plans',
    seeAll: 'See all',
    emptyTitle: 'No training plans yet',
    emptyDescription:
      'Create a plan to start recurring workouts with fixed exercises, target sets and rest times. For spontaneous sessions a free workout is enough.',
    startEntry: 'Start',
    today: 'Today: {{name}}',
    next: 'Up next: {{name}}',
  },
  overview: {
    heading: 'Overview',
    emptyTitle: 'No training data yet',
    emptyDescription:
      'Once you finish your first workout, your weekly overview and the key figures appear here. Every analysis is built exclusively from your local data.',
    thisWeek: 'This week',
    thisWeekHint: 'workouts',
    streak: 'Streak',
    streakHint: 'consecutive weeks',
    workingSetsWeek: 'Working sets wk.',
    cardioWeek: 'Cardio wk.',
    hintThisWeek: 'this week',
    days30: '30 days',
    days30Hint: 'workouts',
    volume30: 'Volume 30 d.',
    volume30Hint: 'weighted exercises',
    lastSession: 'Last workout',
  },
  importDialog: {
    title: 'Import training plan',
    description:
      'Import a shared training plan package or an AI file. Do not have one yet? Have the AI build a plan for you first. Nothing is overwritten on import.',
  },
  errors: {
    sessionAlreadyRunning: 'A workout is already running.',
    startFailed: 'Could not start the workout.',
  },
};
