import type { More } from '@/i18n/locales/de/more';

export const more: More = {
  title: 'More',
  groups: {
    training: 'Training',
    progress: 'Progress',
    data: 'Data',
    app: 'App',
  },
  library: {
    label: 'Library',
    description: 'Reusable workout units and exercises',
  },
  exercises: {
    label: 'Exercises',
    description: 'Create, edit, archive',
  },
  equipment: {
    label: 'Equipment profiles',
    description: 'Available equipment per place — filters the exercise picker',
  },
  bodyData: {
    label: 'Body data',
    description: 'Weight, body fat and circumference measurements',
  },
  aiAnalyses: {
    label: 'AI analyses',
    description: 'Import a response file, feedback and reviewed proposals',
  },
  backup: {
    label: 'Data & backup',
    description: 'Backup, restore, AI and CSV export, reset',
  },
  storage: {
    label: 'Local storage',
    description: 'Storage status and database version',
  },
  settings: {
    label: 'Settings',
    description: 'Training, rests, language, appearance, sound and reminders',
  },
  glossary: {
    label: 'Glossary',
    description: 'Terms like RPE, RIR, e1RM and volume explained',
  },
  privacy: {
    label: 'Privacy',
    description: 'What is stored — and what is not',
  },
  screens: {
    action: {
      add: 'Add',
      cancel: 'Cancel',
      change: 'Change',
      choose: 'Choose',
      close: 'Close',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      new: 'New',
      save: 'Save',
      saving: 'Saving …',
    },
    body: {
      title: 'Body data',
      subtitle: 'Optional — not required for training analytics',
      form: {
        title: 'Add entry',
        subtitle:
          'One entry is kept per day. If you enter more data for the same day, the values are merged and previously saved measurements are preserved.',
        date: 'Date',
        weight: 'Weight (kg)',
        weightPlaceholder: 'e.g. 78.5',
        bodyFat: 'Body fat (%)',
        bodyFatPlaceholder: 'e.g. 17.5',
        measurements: 'Body measurements (cm)',
        showMeasurements: 'Show',
        hideMeasurements: 'Hide',
        measurementsHint:
          'All fields are optional. Only enter values you actually measured — empty fields stay empty and are never estimated.',
        note: 'Note',
        notePlaceholder: 'Optional, e.g. first thing in the morning',
      },
      validation: {
        weight: 'Enter a weight between 0 and 700 kg.',
        bodyFat: 'Enter a body-fat percentage between 0 and 70%.',
        measurement: 'Enter a value between 0 and 300 cm.',
        atLeastOne: 'Enter at least one value.',
      },
      toast: {
        saved: 'Body data saved.',
        deleted: 'Entry deleted.',
      },
      empty: {
        title: 'No entries yet',
        description:
          'The body-data diary is optional. Weight, body fat and measurements are deliberately excluded from volume calculations — bodyweight exercises are not assigned an estimated kilogram volume.',
      },
      stats: {
        weight: 'Weight',
        bodyFat: 'Body fat',
        waist: 'Waist',
        chest: 'Chest',
        current: 'current',
        sinceStart: '{{value}} since the start',
      },
      list: {
        measurementsOnly: 'Measurements only',
        deleteEntry: 'Delete entry from {{date}}',
      },
      measurements: {
        neckCm: 'Neck',
        shoulderCm: 'Shoulders',
        chestCm: 'Chest',
        waistCm: 'Waist',
        hipCm: 'Hips',
        bicepsLeftCm: 'Left biceps',
        bicepsRightCm: 'Right biceps',
        forearmLeftCm: 'Left forearm',
        forearmRightCm: 'Right forearm',
        thighLeftCm: 'Left thigh',
        thighRightCm: 'Right thigh',
        calfLeftCm: 'Left calf',
        calfRightCm: 'Right calf',
      },
      chart: {
        title: 'Charts',
        subtitle: 'One measurement series over time',
        insufficient:
          'Once you have recorded a measurement on at least two days, its trend will appear here.',
        series: 'Measurement',
        range: 'Range',
        ranges: {
          '4w': '4 wk',
          '12w': '12 wk',
          '6m': '6 mo',
          all: 'All',
        },
        rangeLong: {
          '4w': '4 weeks',
          '12w': '12 weeks',
          '6m': '6 months',
          all: 'All',
        },
        showTrend: 'Show moving trend',
        trendHint:
          'A smoothed trend for the same measurement series. The raw values remain visible.',
        noMeasurements: 'There are no measurements in this range.',
        summary:
          '{{label}}: {{amount}} measurements in the {{range}} range. Latest {{latest}}{{change}}',
        change: ', a change of {{value}} since the start of the range.',
        noChange: '.',
        caption: '{{label}} by measurement',
        columns: {
          date: 'Date',
          value: 'Value',
          trend: 'Trend',
        },
        metrics: {
          weightKg: 'Body weight',
          bodyFatPercent: 'Body-fat percentage',
          neckCm: 'Neck',
          shoulderCm: 'Shoulders',
          chestCm: 'Chest',
          waistCm: 'Waist',
          hipCm: 'Hips',
          bicepsLeftCm: 'Left biceps',
          bicepsRightCm: 'Right biceps',
          forearmLeftCm: 'Left forearm',
          forearmRightCm: 'Right forearm',
          thighLeftCm: 'Left thigh',
          thighRightCm: 'Right thigh',
          calfLeftCm: 'Left calf',
          calfRightCm: 'Right calf',
        },
      },
    },
    equipmentProfiles: {
      title: 'Equipment profiles',
      subtitle: 'Optional — hide exercises when their equipment is unavailable',
      active: {
        title: 'Active profile',
        subtitle: 'Used when adding exercises to plans and workouts.',
        unknown: 'Unknown',
        none: 'No active profile — all exercises are available.',
        disable: 'Disable profile',
      },
      list: {
        title: 'Profiles',
        emptyTitle: 'No profiles yet',
        emptyDescription:
          'Create a profile such as Home, Gym or Hotel and select the equipment available there. You can then limit exercise pickers to available equipment.',
        activeBadge: 'active',
        noneSelected: 'No equipment selected',
        edit: 'Edit {{name}}',
        delete: 'Delete {{name}}',
        activate: 'Activate',
      },
      toast: {
        saved: 'Profile saved.',
        deleted: 'Profile deleted.',
      },
      deleteDialog: {
        title: 'Delete profile?',
        description:
          'The equipment profile will be removed. Your exercises remain unchanged.',
      },
      editor: {
        editTitle: 'Edit profile',
        newTitle: 'New profile',
        name: 'Name',
        namePlaceholder: 'e.g. Home',
        equipment: 'Available equipment',
        emptyEquipment: 'No equipment is known yet. Add some below.',
        addEquipment: 'Add equipment',
        equipmentPlaceholder: 'e.g. Kettlebell',
      },
    },
    exercise: {
      musclePicker: {
        done: 'Done',
        search: 'Search',
        placeholder: 'Name, category, or e.g. “lat”, “rear delt”',
        noMatchTitle: 'No results',
        noMatchDescription:
          'Adjust your search. You can search by name, category, or German and English terms.',
      },
      picker: {
        defaultTitle: 'Add exercise',
        newExercise: 'New exercise',
        search: 'Search',
        searchPlaceholder: 'Name, muscle group or equipment',
        onlyAvailable: 'Available equipment only ({{name}})',
        emptyTitle: 'No exercises yet',
        noMatchTitle: 'No matches',
        emptyDescription:
          'Create your first exercise and choose how to track it — with weight, bodyweight or time.',
        noMatchDescription: 'Change the search or create a new exercise.',
        createFromSearch: 'Create “{{name}}” as a new exercise',
      },
      chips: {
        empty: 'No muscle group selected yet.',
        custom: '(custom)',
        remove: 'Remove {{label}}',
      },
      form: {
        editTitle: 'Edit exercise',
        newTitle: 'New exercise',
        name: 'Name',
        namePlaceholder: 'e.g. Bench press',
        primaryMuscle: 'Primary muscle group',
        secondaryMuscles: 'Secondary muscle groups',
        equipment: 'Equipment',
        equipmentPlaceholder: 'e.g. Barbell',
        trackingType: 'Tracking type',
        cardioModality: 'Cardio activity',
        cardioModalityHint:
          'Determines the analytics convention, such as the pace unit. The device is selected separately.',
        defaultCardioEquipment: 'Default device',
        defaultStrengthEquipment: 'Default equipment',
        defaultEquipmentHint:
          'Starting value for new workouts. You can temporarily change the execution during a workout without changing the exercise.',
        weightMode: 'Weight convention',
        weightMultiplier: 'Weight multiplier',
        weightMultiplierHint:
          'With two 20 kg dumbbells, a multiplier of 2 results in a total load of 40 kg.',
        cardioRest: 'Default rest between intervals (seconds)',
        strengthRest: 'Default rest (seconds)',
        progression: 'Progression (optional)',
        progressionHint:
          'These details improve the local progression suggestion. Without them, a standard increment is assumed — nothing is estimated or changed automatically.',
        increment: 'Smallest weight increment (kg)',
        incrementPlaceholder: 'Default: 2.5',
        availableWeights: 'Available weights (kg)',
        availableWeightsHint:
          'Separate with commas, e.g. 10, 12.5, 15, 17.5. Suggestions will then use only a weight you actually have.',
        progressionMethod: 'Preferred progression',
        progressionMethods: {
          auto: 'Automatic (by tracking type)',
          weight: 'Increase weight first',
          reps: 'Increase reps first',
        },
        targetRir: 'Target RIR',
        targetRirHint:
          'Repetitions left in reserve. Higher means easier. Leave empty if you do not use RIR.',
        techniqueCues: 'Technique cues (optional)',
        techniqueCuesHint:
          'One short cue per line, e.g. keep shoulder blades set. Shown during the workout.',
        alternatives: 'Alternative exercises (optional)',
        alternativesHint:
          'Manually selected substitutions that are quick to choose during a workout, e.g. when a machine is occupied.',
        notes: 'Notes',
        notesPlaceholder: 'e.g. grip width, seat position',
        validation: {
          nameRequired: 'Enter a name.',
          nameTooLong: 'The name is too long (maximum 80 characters).',
          nameDuplicate: 'An exercise with this name already exists.',
          multiplierPositive: 'The multiplier must be greater than 0.',
          multiplierHigh: 'The multiplier seems unrealistically high.',
          restRange: 'Rest must be between 0 and 3600 seconds.',
        },
        toast: {
          saved: 'Exercise saved.',
          created: 'Exercise created.',
          saveFailed: 'The exercise could not be saved.',
        },
      },
      detail: {
        genericTitle: 'Exercise',
        notFoundTitle: 'Exercise not found',
        notFoundDescription: 'This exercise no longer exists.',
        technique: 'Technique',
        executionAndGoal: 'Execution & target',
        nextTarget: 'Target for the next session: RIR {{value}}',
        noHistoryTitle: 'No history yet',
        noHistoryDescription:
          'Once you log this exercise in a workout, its record, trend and recent sessions will appear here.',
        recentSessions: 'Recent sessions',
        recordAndLatest: 'Record & latest performance',
        bestE1rm: 'Best e1RM',
        estimatePrefix: 'approx. {{value}}',
        estimateHint: 'Estimate',
        heaviestSet: 'Heaviest set',
        reps: '× {{value}} reps',
        latest: 'Latest',
        volume: '{{value}} volume',
        chartTitle: 'Estimated 1RM — 8 weeks',
        chartSummary:
          'Estimated 1RM trend across {{amount}} sessions in the last 8 weeks. Epley estimate, not a measurement.',
        chartCaption: 'Estimated 1RM by session',
        date: 'Date',
      },
    },
    glossary: {
      title: 'Glossary',
      intro:
        'Short, clear explanations of technical terms. Estimates are marked as such and never presented as measurements.',
      example: 'Example: ',
      whatMeans: 'What does {{term}} mean?',
      entries: {
        rpe: {
          term: 'RPE',
          definition:
            'Rate of Perceived Exertion — how hard a set felt on a scale from 1 to 10.',
          example: 'RPE 8 means hard, but roughly 2 more reps would have been possible.',
          caveat:
            'Subjective and personal — not a measurement and not comparable between people.',
        },
        rir: {
          term: 'RIR',
          definition:
            'Reps in Reserve — how many repetitions would still have been possible at the end of a set.',
          example: 'RIR 2 means 2 more clean reps were possible after the final rep.',
          caveat:
            'An estimate. RPE and RIR can only be converted into one another approximately.',
        },
        oneRm: {
          term: '1RM',
          definition:
            'One-rep max — the heaviest weight you can move for exactly one repetition.',
          example: 'If you can lift 100 kg exactly once, your 1RM is 100 kg.',
          caveat:
            'A true 1RM is actually tested — the app does not measure it, but estimates it (see e1RM).',
        },
        e1rm: {
          term: 'e1RM',
          definition:
            'Estimated 1RM — calculated from weight and reps with the Epley formula, without testing a maximum.',
          example: '20 kg × 12 gives an e1RM of about 28 kg (20 × (1 + 12 / 30)).',
          caveat:
            'Only an estimate, most reliable for 1–12 reps and exercises with external weight.',
        },
        volume: {
          term: 'Training volume',
          definition:
            'The total load completed for an exercise or workout: weight × reps, summed across all counted sets.',
          example: '3 sets of 50 kg × 10 produce 1,500 kg of volume.',
          caveat:
            'Only for exercises with a meaningful kilogram load; bodyweight and timed exercises produce no kg volume.',
        },
        workingSet: {
          term: 'Working set',
          definition:
            'A true loading set that counts toward the training target, unlike a warm-up set.',
          example: 'After 2 warm-up sets, the 3 heavy sets count as working sets.',
          caveat:
            'Warm-up, drop, and failure sets are handled separately depending on the analysis.',
        },
        intensity: {
          term: 'Intensity',
          definition:
            'How heavy the weight is relative to your maximum — the closer to 1RM, the higher the intensity.',
          example:
            '5 reps at 90% of 1RM are high intensity; 15 light reps are low intensity.',
          caveat: 'Intensity is not the same as training volume or perceived effort.',
        },
        deload: {
          term: 'Deload',
          definition:
            'A deliberately easier week with reduced targets to support recovery.',
          example: 'Weight or sets are reduced as planned during a deload week.',
          caveat:
            'A planned reduction — it is marked in analytics and comparisons and is not treated as regression.',
        },
        pace: {
          term: 'Pace',
          definition:
            'Cardio speed, usually expressed as time per distance (e.g. min/km) or speed (km/h).',
          example: '5 km in 25 minutes gives a pace of 5:00 min/km.',
          caveat: 'Can only be calculated when both duration and distance are recorded.',
        },
        restAdherence: {
          term: 'Rest adherence',
          definition:
            'How closely actual rest between sets matches the planned rest time.',
          example: 'Target rest 90 s, actual average 95 s — rest adherence is high.',
          caveat: 'Deviations only show timing differences and are not a quality rating.',
        },
        muscleGroups: {
          term: 'Primary & secondary muscle group',
          definition:
            'Primary muscles are the main muscles in an exercise; secondary muscles assist them.',
          example:
            'In the bench press, chest is primary, while triceps and front deltoids are secondary.',
          caveat:
            'The assignment describes training involvement and is not a medical assessment.',
        },
      },
    },
    privacy: {
      title: 'Privacy',
      sections: {
        local: {
          title: 'All data stays on this device',
          text: 'Exercises, training plans, workouts, sets, rest periods, notes and body weight are stored exclusively in this browser’s local database (IndexedDB).',
        },
        noServer: {
          title: 'No transfer to a server',
          text: 'The app has no backend and, after loading, does not contact external services, fonts or APIs. Your training data is not transferred.',
        },
        noAccount: {
          title: 'No user account',
          text: 'There is no registration, login or user management. The app does not know who you are.',
        },
        noTracking: {
          title: 'No tracking, no ads',
          text: 'No cookies are set, no analytics services are embedded and no usage data is collected or sent.',
        },
        browserData: {
          title: 'Clearing browser data removes your history',
          text: 'If you clear this site’s browser data, remove the app from your home screen or use private browsing, your training history may be lost.',
        },
        backups: {
          title: 'Regular backups are recommended',
          text: 'Regularly create a full backup under “Data & backup” and save it somewhere you control. This is the only way to move to another device.',
        },
        aiExport: {
          title: 'You control the AI export',
          text: 'The export for an external AI is created entirely locally and saved as a file. The data only leaves your device if you share that file yourself, such as by uploading it to a chat. The file contains only what you selected before exporting.',
        },
      },
      communityTitle: 'Community links: Ko-fi and feedback form',
      communityText:
        'Community entries only open an external service in a new tab after you choose them (Ko-fi for voluntary support and Tally for feedback). Starting the app normally loads no Ko-fi or Tally resources — no iframes, widgets or scripts. Training data, body data, notes and backups are never transferred automatically, and no parameters containing app data are appended. Whatever you voluntarily enter in the form is processed by Tally; contact email and screenshots are explicitly optional. Payments through Ko-fi are voluntary support and are not tax-deductible donations.',
      tallyLink: 'Tally privacy information',
    },
    checkIn: {
      filled: 'Completed · tap to open',
      noValue: 'not specified',
      reset: 'reset',
      optional: 'Optional',
      pre: {
        title: 'Before the workout',
        subtitle: 'Optional · takes a few seconds',
        energy: 'Energy',
        sleep: 'Sleep quality',
        motivation: 'Motivation',
        soreness: 'Muscle soreness',
        pain: 'Pain or limitation',
        painPlaceholder: 'e.g. sore knee, be careful with shoulder',
        note: 'Note',
      },
      post: {
        title: 'After the workout',
        subtitle: 'Optional · how was the session?',
        quality: 'Workout quality',
        difficulty: 'Difficulty',
        satisfaction: 'Satisfaction',
        note: 'Note',
      },
      scale: {
        low: 'low',
        high: 'high',
        bad: 'poor',
        good: 'good',
        none: 'none',
        strong: 'strong',
        top: 'great',
        easy: 'easy',
        veryHard: 'very hard',
      },
    },
    weeklyGoals: {
      intro:
        'Goals are optional and only help you stay consistent. Empty fields mean “no goal”.',
      noGoal: 'no goal',
      sessions: 'Training sessions per week',
      workingSets: 'Working sets per week',
      workingSetsHint: 'Strength only — cardio is not included here.',
      cardioMinutes: 'Cardio minutes per week',
      cardioDistance: 'Cardio distance per week (km)',
      cardioSessions: 'Cardio sessions per week',
      exerciseGoals: 'Exercise goals (optional)',
      noExerciseGoals:
        'No exercise-specific goals yet. For example, you can set “Squats twice per week”.',
      removeExerciseGoal: 'Remove goal for {{name}}',
      goal: 'Goal',
      sessionsPerWeek: 'Sessions/week',
      setsPerWeek: 'Sets/week',
      amount: 'Amount',
      addExercise: 'Add exercise',
      chooseExercise: 'Choose exercise …',
    },
    dialog: {
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    errorBoundary: {
      title: 'Something went unexpectedly wrong',
      text: 'Your training data is not affected — it is still stored locally on this device. You can reload the view and carry on as usual.',
      retry: 'Try again',
      reload: 'Reload app',
    },
  },
};
