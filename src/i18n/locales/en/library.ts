import type { Library } from '@/i18n/locales/de/library';

export const library: Library = {
  title: 'Library',
  tabs: {
    units: 'Workout units',
    exercises: 'Exercises',
  },
  count: {
    exerciseOne: '{{count}} exercise',
    exerciseOther: '{{count}} exercises',
    unitOne: '{{count}} unit',
    unitOther: '{{count}} units',
  },
  unit: {
    fallbackName: 'Unit',
    title: 'Workout unit',
    create: 'New workout unit',
    createAction: 'Create workout unit',
    createAndEdit: 'Create and edit',
    importAction: 'Import workout unit',
    editAction: 'Edit “{{name}}”',
    edit: 'Edit unit',
    duplicateAction: 'Duplicate “{{name}}”',
    duplicated: 'Workout unit duplicated.',
    shareAction: 'Share “{{name}}”',
    deleteAction: 'Delete “{{name}}”',
    start: 'Start',
    startNamed: 'Start “{{name}}”',
    startAlreadyRunning: 'A workout is already running',
    startFailed: 'Could not start workout.',
    addToPlan: 'Add to plan',
    addedToPlan: 'Added to “{{name}}”.',
    empty: {
      title: 'No workout units yet',
      description:
        'Create reusable units such as “Push”, “Pull” or “Full Body A”. You can add them to plans later or start them directly.',
    },
    notFound: {
      title: 'Not found',
      description: 'This workout unit no longer exists.',
      back: 'Back to library',
    },
    delete: {
      title: 'Delete workout unit?',
      description:
        'The unit will be removed from the library. Copies already added to plans and your workout history remain unchanged.',
      success: 'Workout unit deleted.',
    },
  },
  field: {
    name: 'Name',
    description: 'Description',
    descriptionOptional: 'Description (optional)',
    namePlaceholder: 'e.g. Push',
  },
  planPicker: {
    title: 'Add to which plan?',
    empty: 'There are no training plans yet.',
    fallbackName: 'Plan',
  },
  import: {
    readFailed: 'The file could not be read.',
    unavailableTitle: 'Import unavailable',
    confirmTitle: 'Import workout units?',
    success: '{{units}} imported, {{exercises}} new.',
    previewUnits: '{{units}}:',
    previewSummary:
      '{{newExercises}} new exercises, {{reusedExercises}} will be reused. Existing units and your history remain unchanged.',
    alreadyImported:
      'This file has already been imported. Importing it again will create copies.',
    confirm: 'Import now',
  },
  exercise: {
    add: 'Add exercise',
    deleted: 'Deleted exercise',
    missing: 'This exercise no longer exists.',
    empty: {
      title: 'No exercises yet',
      description:
        'Add exercises to this unit. You can then configure targets and groups right here.',
    },
    moveUp: 'Move {{name}} up',
    moveDown: 'Move {{name}} down',
    remove: 'Remove {{name}}',
    detachGroup: 'Remove from group',
    attachPrevious: 'Group with exercise above',
  },
  targets: {
    intervals: 'Intervals',
    sets: 'Sets',
    intervalRestSeconds: 'Rest between intervals (s)',
    restSeconds: 'Rest (s)',
    duration: 'Target duration',
    distanceMeters: 'Target distance (m)',
    rpe: 'Target RPE (1–10)',
    repsFrom: 'Reps from',
    repsTo: 'Reps to',
    note: 'Note',
    optional: 'Optional',
  },
  summary: {
    sets: '{{value}} sets',
    intervals: '{{value}} intervals',
    reps: '{{min}}–{{max}} reps',
    repsFrom: 'from {{min}} reps',
    repsTo: 'up to {{max}} reps',
    duration: '{{value}} s',
    durationMs: '{{value}} min',
    durationHms: '{{value}} h',
    distance: '{{value}} m',
    rpe: 'RPE {{value}}',
    rest: 'Rest {{value}} s',
    noRest: 'no rest',
  },
  group: {
    summary: '{{type}} · {{exercises}}',
    typeLabel: 'Group type',
    type: {
      superset: 'Superset',
      circuit: 'Circuit',
    },
    restLabel: 'Rest',
    rest: {
      round: 'After each round',
      each: 'After each exercise',
    },
  },
  share: {
    title: 'Share workout unit',
    systemTitle: 'Share workout unit “{{name}}”',
    description:
      '“{{name}}” with {{exercises}} will be shared as a portable file. It only contains the unit, its exercises and targets — no workout history, body data or internal IDs.',
    includeNotes: 'Include notes',
    download: 'Download',
    fallbackHint:
      'If sharing is not supported, the app downloads the file instead — you can then send it via WhatsApp, for example.',
    failed: 'Sharing failed.',
    saved: 'File saved.',
    result: {
      sharedFile: 'File handed off for sharing.',
      sharedText: 'Data handed off for sharing as text.',
      cancelled: 'Sharing cancelled.',
      downloadedCopied:
        'Sharing is not supported here. The file was saved and its contents copied to the clipboard.',
      downloaded: 'Sharing is not supported here. The file was saved.',
      failed: 'The file could not be created.',
    },
  },
  compare: {
    title: 'Compare units',
    subtitle: 'Two library workout units side by side',
    empty: {
      title: 'Not enough used units',
      description:
        'Once you have trained at least two workout units from your library, either directly or as a plan day, you can compare them here.',
    },
    units: 'Units',
    unitA: 'Unit A',
    unitB: 'Unit B',
    deload: 'Deload',
    deloadOptions: {
      include: 'Include deload',
      exclude: 'Exclude deload',
      only: 'Deload only',
    },
    chooseDifferent: 'Please select two different units.',
    calculating: 'Calculating comparison …',
    weekShort: '{{count}} wk.',
  },
};
