import { PLAN_PACKAGE_FORMAT } from '@/constants/formats';

/**
 * Test fixtures for the plan-package format. Kept as plain objects (not parsed)
 * so tests can deliberately mutate them into invalid, v1 or future-version
 * shapes.
 */

/** A valid current (v2) package: one plan with two days and a superset. */
export function validPlanPackage() {
  return {
    format: PLAN_PACKAGE_FORMAT,
    schemaVersion: 2,
    packageId: 'pkg-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'ai-generated', label: 'ChatGPT' },
    packageName: 'Push Pull Beine',
    programNotes: 'Drei Einheiten pro Woche.',
    exercises: [
      {
        exerciseKey: 'exercise-1',
        name: 'Bankdrücken',
        primaryMuscleGroup: 'Brust',
        secondaryMuscleGroups: ['Trizeps', 'Vordere Schulter'],
        equipment: 'Langhantel',
        trackingType: 'weight_reps',
        weightMode: 'total',
        weightMultiplier: 1,
        defaultRestSeconds: 180,
        alternativeExerciseKeys: ['exercise-2'],
        notes: 'Schulterblätter zusammen.',
      },
      {
        exerciseKey: 'exercise-2',
        name: 'Kurzhantel-Bankdrücken',
        primaryMuscleGroup: 'Brust',
        secondaryMuscleGroups: ['Trizeps'],
        equipment: 'Kurzhantel',
        trackingType: 'weight_reps',
        weightMode: 'per_hand',
        weightMultiplier: 2,
        defaultRestSeconds: 150,
        notes: '',
      },
      {
        exerciseKey: 'exercise-3',
        name: 'Klimmzug',
        primaryMuscleGroup: 'Latissimus',
        secondaryMuscleGroups: ['Bizeps'],
        equipment: 'Klimmzugstange',
        trackingType: 'bodyweight_reps',
        weightMode: 'added_weight',
        weightMultiplier: 1,
        defaultRestSeconds: 150,
        notes: '',
      },
    ],
    plans: [
      {
        planKey: 'plan-1',
        name: 'Oberkörper',
        description: '',
        splitType: '2-day',
        days: [
          {
            dayKey: 'day-1',
            name: 'Push',
            description: '',
            position: 0,
            exercises: [
              {
                planExerciseKey: 'pe-1',
                exerciseKey: 'exercise-1',
                order: 0,
                targetSets: 4,
                targetRepMin: 5,
                targetRepMax: 8,
                targetDurationSeconds: null,
                restSeconds: 180,
                notes: '',
                group: { groupKey: 'group-1', type: 'superset', restMode: 'round' },
              },
              {
                planExerciseKey: 'pe-2',
                exerciseKey: 'exercise-2',
                order: 1,
                targetSets: 3,
                targetRepMin: 8,
                targetRepMax: 12,
                targetDurationSeconds: null,
                restSeconds: 150,
                notes: '',
                group: { groupKey: 'group-1', type: 'superset', restMode: 'round' },
              },
            ],
          },
          {
            dayKey: 'day-2',
            name: 'Pull',
            description: '',
            position: 1,
            exercises: [
              {
                planExerciseKey: 'pe-3',
                exerciseKey: 'exercise-3',
                order: 0,
                targetSets: 4,
                targetRepMin: 6,
                targetRepMax: 10,
                targetDurationSeconds: null,
                restSeconds: 180,
                notes: '',
                group: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A valid version-1 package (single implicit day) for upgrade tests. */
export function validPlanPackageV1() {
  return {
    format: PLAN_PACKAGE_FORMAT,
    schemaVersion: 1,
    packageId: 'pkg-v1',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'ai-generated', label: 'ChatGPT' },
    packageName: 'Ganzkörper',
    programNotes: '',
    exercises: [
      {
        exerciseKey: 'exercise-1',
        name: 'Kniebeuge',
        primaryMuscleGroup: 'Quadrizeps',
        secondaryMuscleGroups: ['Gesäß'],
        equipment: 'Langhantel',
        trackingType: 'weight_reps',
        weightMode: 'total',
        weightMultiplier: 1,
        defaultRestSeconds: 180,
        notes: '',
      },
    ],
    plans: [
      {
        planKey: 'plan-1',
        name: 'Ganzkörper A',
        description: '',
        exercises: [
          {
            planExerciseKey: 'pe-1',
            exerciseKey: 'exercise-1',
            order: 0,
            targetSets: 3,
            targetRepMin: 5,
            targetRepMax: 8,
            targetDurationSeconds: null,
            restSeconds: 180,
            notes: '',
            group: null,
          },
        ],
      },
    ],
  };
}
