import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  closeOpenRests,
  completeSet,
  endRest,
  finishSession,
  startFreeSession,
} from '@/db/repositories/sessions';
import { computeRestStatistics } from '@/services/rest';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { WorkoutSet } from '@/types';

/**
 * The "at most one running rest per workout" invariant.
 *
 * A workout may only ever have one open rest, because the live view shows the
 * most recent one. An older open rest would be invisible to the user and its
 * duration would never be recorded.
 */

const EXERCISE = {
  name: 'Bankdrücken',
  primaryMuscleGroup: 'Brust',
  secondaryMuscleGroups: [],
  equipment: 'Langhantel',
  trackingType: 'weight_reps' as const,
  weightMode: 'total' as const,
  weightMultiplier: 1,
  defaultRestSeconds: 120,
  notes: '',
};

async function seed() {
  const exercise = await createExercise(EXERCISE);
  const session = await startFreeSession();
  const sessionExercise = await addExerciseToSession(session.id, exercise);
  return { session, sessionExercise };
}

async function allSets(): Promise<WorkoutSet[]> {
  const sets = await db.workoutSets.toArray();
  return sets.sort((a, b) => a.position - b.position);
}

function openRests(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((set) => set.restStartedAt && !set.restEndedAt);
}

beforeEach(async () => {
  await resetDatabase();
});

describe('at most one open rest per workout', () => {
  it('closes the previous rest when the next set is completed', async () => {
    const { sessionExercise } = await seed();

    const first = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(first.id, { weightKg: 80, reps: 8 });

    const second = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(second.id, { weightKg: 80, reps: 8 });

    const sets = await allSets();
    expect(openRests(sets)).toHaveLength(1);
    // The still-running rest belongs to the set just completed.
    expect(openRests(sets)[0].id).toBe(second.id);

    // The first rest was closed and its duration recorded.
    const closed = sets.find((set) => set.id === first.id)!;
    expect(closed.restEndedAt).toBeTruthy();
    expect(closed.restActualSeconds).toBeGreaterThanOrEqual(0);
  });

  it('leaves no open rest behind across many sets in quick succession', async () => {
    const { sessionExercise } = await seed();

    for (let index = 0; index < 5; index++) {
      const set = await addSet(sessionExercise.id, { restTargetSeconds: 90 });
      await completeSet(set.id, { weightKg: 60, reps: 10 });
    }

    expect(openRests(await allSets())).toHaveLength(1);
  });

  it('also closes rests of a different exercise in the same workout', async () => {
    const { session, sessionExercise } = await seed();
    const other = await createExercise({ ...EXERCISE, name: 'Rudern' });
    const otherSessionExercise = await addExerciseToSession(session.id, other);

    const first = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(first.id, { weightKg: 80, reps: 8 });

    const second = await addSet(otherSessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(second.id, { weightKg: 50, reps: 10 });

    const sets = await allSets();
    expect(openRests(sets)).toHaveLength(1);
    expect(openRests(sets)[0].id).toBe(second.id);
  });

  it('does not touch rests of a different workout', async () => {
    const { sessionExercise, session } = await seed();
    const first = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(first.id, { weightKg: 80, reps: 8 });
    await finishSession(session.id);

    const secondSeed = await seed();
    const second = await addSet(secondSeed.sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(second.id, { weightKg: 80, reps: 8 });

    // The finished workout keeps its own recorded duration untouched.
    const firstSet = await db.workoutSets.get(first.id);
    expect(firstSet?.restEndedAt).toBeTruthy();
    expect(openRests(await allSets())).toHaveLength(1);
  });
});

describe('finishing a workout ends the running rest without counting it', () => {
  it('ends the final rest but does not record its duration', async () => {
    const { session, sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    expect(openRests(await allSets())).toHaveLength(1);

    await finishSession(session.id);

    const sets = await allSets();
    expect(openRests(sets)).toHaveLength(0);
    expect(sets[0].restEndedAt).toBeTruthy();
    // The rest after the last set is not a real between-set rest — its duration
    // is deliberately not recorded, so it never distorts the rest statistics.
    expect(sets[0].restActualSeconds).toBeUndefined();
  });

  it('closes the rest against the workout finish time', async () => {
    const { session, sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    await finishSession(session.id);

    const stored = await db.workoutSets.get(set.id);
    const finished = await db.workoutSessions.get(session.id);
    expect(stored?.restEndedAt).toBe(finished?.finishedAt);
  });

  it('keeps the final rest out of the rest statistics', async () => {
    const { session, sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });
    await finishSession(session.id);

    const stats = computeRestStatistics(await allSets());
    // A trailing rest with no recorded actual duration must not be evaluated.
    expect(stats.evaluatedSets).toBe(0);
  });

  it('keeps a real between-set rest counted while dropping the trailing one', async () => {
    const { session, sessionExercise } = await seed();
    const first = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(first.id, { weightKg: 80, reps: 8 });
    // A second set closes the first rest (a real between-set rest) and opens a
    // new trailing rest.
    const second = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(second.id, { weightKg: 80, reps: 6 });

    await finishSession(session.id);

    const stats = computeRestStatistics(await allSets());
    // Only the first, real between-set rest is evaluated; the trailing one is not.
    expect(stats.evaluatedSets).toBe(1);
    expect((await db.workoutSets.get(first.id))?.restActualSeconds).toBeGreaterThanOrEqual(0);
    expect((await db.workoutSets.get(second.id))?.restActualSeconds).toBeUndefined();
  });
});

describe('idempotency', () => {
  it('keeps the recorded duration when a rest is ended twice', async () => {
    const { sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    const startedAt = new Date((await db.workoutSets.get(set.id))!.restStartedAt!);
    await endRest(set.id, new Date(startedAt.getTime() + 100_000));
    const afterFirst = await db.workoutSets.get(set.id);

    // A second tap on "end rest" must not overwrite the measured value.
    await endRest(set.id, new Date(startedAt.getTime() + 500_000));
    const afterSecond = await db.workoutSets.get(set.id);

    expect(afterSecond?.restActualSeconds).toBe(100);
    expect(afterSecond?.restEndedAt).toBe(afterFirst?.restEndedAt);
  });

  it('changes nothing when closing open rests twice', async () => {
    const { session, sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    expect(await closeOpenRests(session.id)).toBe(1);
    const afterFirst = await db.workoutSets.get(set.id);

    expect(await closeOpenRests(session.id)).toBe(0);
    const afterSecond = await db.workoutSets.get(set.id);

    expect(afterSecond?.restActualSeconds).toBe(afterFirst?.restActualSeconds);
  });

  it('stays a no-op when finishing a workout that has no open rest', async () => {
    const { session, sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });
    await endRest(set.id);

    const before = await db.workoutSets.get(set.id);
    await finishSession(session.id);
    const after = await db.workoutSets.get(set.id);

    expect(after?.restActualSeconds).toBe(before?.restActualSeconds);
    expect(after?.restEndedAt).toBe(before?.restEndedAt);
  });

  it('never records a negative rest, even if the clock jumps backwards', async () => {
    const { sessionExercise } = await seed();
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    const startedAt = new Date((await db.workoutSets.get(set.id))!.restStartedAt!);
    await endRest(set.id, new Date(startedAt.getTime() - 60_000));

    expect((await db.workoutSets.get(set.id))?.restActualSeconds).toBe(0);
  });
});
