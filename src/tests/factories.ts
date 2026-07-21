import type {
  Exercise,
  SessionExercise,
  SetWithContext,
  TrackingType,
  WeightMode,
  WorkoutSession,
  WorkoutSet,
} from '@/types';

/**
 * Builders for test data.
 *
 * Every field has a sensible default so a test only has to state the values it
 * actually cares about.
 */

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function resetFactoryCounter(): void {
  counter = 0;
}

const NOW = '2026-07-01T08:00:00.000Z';

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: nextId('exercise'),
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: ['Trizeps'],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  const startedAt = overrides.startedAt ?? NOW;
  return {
    id: nextId('session'),
    name: 'Training',
    status: 'completed',
    startedAt,
    finishedAt: new Date(new Date(startedAt).getTime() + 3600_000).toISOString(),
    notes: '',
    createdAt: startedAt,
    updatedAt: startedAt,
    ...overrides,
  };
}

export function makeSessionExercise(
  overrides: Partial<SessionExercise> = {},
): SessionExercise {
  return {
    id: nextId('session-exercise'),
    sessionId: 'session-1',
    exerciseId: 'exercise-1',
    order: 0,
    exerciseNameSnapshot: 'Bankdrücken',
    trackingTypeSnapshot: 'weight_reps' as TrackingType,
    weightModeSnapshot: 'total' as WeightMode,
    weightMultiplierSnapshot: 1,
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: nextId('set'),
    sessionExerciseId: 'session-exercise-1',
    position: 0,
    setType: 'working',
    weightKg: 100,
    reps: 10,
    restTargetSeconds: 120,
    completedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Convenience builder that wires a set to its exercise and session. */
export function makeContext(
  set: Partial<WorkoutSet> = {},
  sessionExercise: Partial<SessionExercise> = {},
  session: Partial<WorkoutSession> = {},
): SetWithContext {
  const builtSession = makeSession(session);
  const builtExercise = makeSessionExercise({
    sessionId: builtSession.id,
    ...sessionExercise,
  });
  const builtSet = makeSet({ sessionExerciseId: builtExercise.id, ...set });
  return { set: builtSet, sessionExercise: builtExercise, session: builtSession };
}
