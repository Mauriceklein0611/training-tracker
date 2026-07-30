import type { History } from '@/i18n/locales/de/history';

export const history: History = {
  title: 'History',
  completedCount: '{{count}} completed workouts',
  search: {
    label: 'Search',
    placeholder: 'Workout, exercise or note',
  },
  period: {
    label: 'Period',
    all: 'All time',
    days7: 'Last 7 days',
    days30: 'Last 30 days',
    days90: 'Last 90 days',
  },
  selectedDay: 'Selected day: {{date}}',
  clearSelection: 'Clear selection',
  kind: {
    strength: 'Strength',
    cardio: 'Cardio',
    mixed: 'Strength + cardio',
  },
  empty: {
    noWorkouts: 'No completed workouts yet',
    noResults: 'No results',
    firstWorkout:
      'Once you finish a workout, it appears here with all sets, rests and notes. You can correct workouts later or reuse one as the basis for a new workout.',
    selectedDay:
      'There is no workout on this day that matches the search and selected period.',
    filters: 'Adjust the search or period.',
  },
  calendar: {
    aria: 'Training calendar',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    intensityBy: 'Show intensity by',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    metric: {
      sets: 'Sets',
      sessions: 'Workouts',
      duration: 'Duration',
    },
    kind: {
      strength: 'Strength',
      cardio: 'Cardio',
      mixed: 'Strength + cardio',
      deload: 'Deload',
      body: 'Body measurement',
    },
    sessionOne: '{{count}} workout',
    sessionOther: '{{count}} workouts',
    setOne: '{{count}} set',
    setOther: '{{count}} sets',
    bodyDay: '{{date}}: body measurement',
    noTraining: '{{date}}: no workout',
    legend:
      'Colour = type of day, saturation = {{metric}} per day. Rest days remain grey.',
  },
  goals: {
    title: 'Weekly goals',
    currentWeek: 'This week',
    progress: '{{label}}: {{actual}} of {{goal}}',
    reached: 'Goal reached',
    remaining: '{{count}} remaining to reach the weekly goal',
    finishedProgress: '{{actual}} of {{goal}} this week',
    sessions: 'Workouts',
    workingSets: 'Working sets',
    cardioMinutes: 'Cardio minutes',
    cardioDistance: 'Cardio distance (km)',
    cardioSessions: 'Cardio workouts',
    exercises: 'Exercises this week',
    exerciseSessions: '{{name}} · workouts',
    exerciseSets: '{{name}} · sets',
    completedWeeks: 'Completed weeks',
    sessionShort: '{{count}} workouts',
  },
  detail: {
    pageTitle: 'Workout',
    notFound: {
      title: 'Workout not found',
      description: 'This workout no longer exists.',
      back: 'Back to history',
    },
    start: {
      active: 'A workout is already in progress.',
      failed: 'Could not start the workout.',
    },
    edit: {
      aria: 'Edit workout',
      name: 'Workout name',
      note: 'Note',
      optional: 'Optional',
    },
    exercises: {
      title: 'Exercises and sets',
      emptyTitle: 'No exercises recorded',
      emptyDescription: 'No sets were saved in this workout.',
      noSets: 'No sets recorded.',
    },
    action: {
      repeat: 'Start a new workout from this one',
      duplicate: 'Duplicate workout',
      delete: 'Delete workout',
    },
    toast: {
      duplicated: 'Workout duplicated.',
      deleted: 'Workout deleted.',
    },
    deleteDialog: {
      title: 'Delete workout?',
      description:
        'All sets and notes from this workout will be permanently deleted. Your analytics will update immediately.',
      confirm: 'Delete permanently',
    },
  },
  setEdit: {
    title: 'Edit set {{position}}',
    toast: {
      updated: 'Set updated.',
      deleted: 'Set deleted.',
    },
    action: {
      confirmDelete: 'Delete this set',
    },
    field: {
      setType: 'Set type',
      repetitions: 'Repetitions',
      durationSeconds: 'Duration (s)',
      targetRestSeconds: 'Target rest (s)',
      actualRestSeconds: 'Actual rest (s)',
    },
  },
};
