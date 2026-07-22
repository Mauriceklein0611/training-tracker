import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  attachSessionExerciseToPrevious,
  completeSet,
  detachSessionExercise,
  getSessionDetail,
  setSessionGroupOptions,
  startFreeSession,
} from '@/db/repositories/sessions';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: 'Test',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

/** Builds a session with two exercises grouped into a round-rest superset. */
async function buildSuperset() {
  const session = await startFreeSession('Superset-Test');
  const exA = await makeExerciseRow('Bankdrücken');
  const exB = await makeExerciseRow('Rudern');
  const seA = await addExerciseToSession(session.id, exA);
  const seB = await addExerciseToSession(session.id, exB);
  await attachSessionExerciseToPrevious(seB.id);
  await setSessionGroupOptions(session.id, (await db.sessionExercises.get(seB.id))!.groupId!, {
    groupRestMode: 'round',
  });
  return { sessionId: session.id, seAId: seA.id, seBId: seB.id };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('session grouping', () => {
  it('attaches a second exercise into a superset with defaults', async () => {
    const { seAId, seBId } = await buildSuperset();
    const a = await db.sessionExercises.get(seAId);
    const b = await db.sessionExercises.get(seBId);

    expect(a?.groupId).toBeTruthy();
    expect(a?.groupId).toBe(b?.groupId);
    expect(a?.groupType).toBe('superset');
    expect(b?.groupRestMode).toBe('round');
  });

  it('dissolves the group when one member is detached (only one left)', async () => {
    const { seAId, seBId } = await buildSuperset();
    await detachSessionExercise(seBId);
    expect((await db.sessionExercises.get(seAId))?.groupId).toBeUndefined();
    expect((await db.sessionExercises.get(seBId))?.groupId).toBeUndefined();
  });
});

describe('round-based rest', () => {
  it('does not start a rest until the round is complete', async () => {
    const { seAId, seBId } = await buildSuperset();

    // Round 1, exercise A: completing it must NOT start a rest.
    const a1 = await addSet(seAId, { restTargetSeconds: 120 });
    await completeSet(a1.id, { weightKg: 60, reps: 8 });
    expect((await db.workoutSets.get(a1.id))?.restStartedAt).toBeUndefined();

    // Round 1, exercise B: this closes the round → rest starts.
    const b1 = await addSet(seBId, { restTargetSeconds: 120 });
    await completeSet(b1.id, { weightKg: 40, reps: 8 });
    expect((await db.workoutSets.get(b1.id))?.restStartedAt).toBeTruthy();
  });

  it('rests after every exercise when the mode is "each"', async () => {
    const { sessionId, seAId } = await buildSuperset();
    const groupId = (await db.sessionExercises.get(seAId))!.groupId!;
    await setSessionGroupOptions(sessionId, groupId, { groupRestMode: 'each' });

    const a1 = await addSet(seAId, { restTargetSeconds: 120 });
    await completeSet(a1.id, { weightKg: 60, reps: 8 });
    expect((await db.workoutSets.get(a1.id))?.restStartedAt).toBeTruthy();
  });

  it('warm-up sets neither advance a round nor trigger a group rest', async () => {
    const { seAId, seBId } = await buildSuperset(); // round-rest superset

    // A warm-up on A: no rest, and it must not count as a round.
    const a0 = await addSet(seAId, { restTargetSeconds: 120, setType: 'warmup' });
    await completeSet(a0.id, { weightKg: 20, reps: 10 });
    expect((await db.workoutSets.get(a0.id))?.restStartedAt).toBeUndefined();

    // A working set on A: round still open (B has not done its working set).
    const a1 = await addSet(seAId, { restTargetSeconds: 120 });
    await completeSet(a1.id, { weightKg: 60, reps: 8 });
    expect((await db.workoutSets.get(a1.id))?.restStartedAt).toBeUndefined();

    // A working set on B: closes the round → rest starts.
    const b1 = await addSet(seBId, { restTargetSeconds: 120 });
    await completeSet(b1.id, { weightKg: 40, reps: 8 });
    expect((await db.workoutSets.get(b1.id))?.restStartedAt).toBeTruthy();
  });

  it('keeps single exercises resting normally after every set', async () => {
    const session = await startFreeSession('Single');
    const exercise = await makeExerciseRow('Kniebeuge');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 100, reps: 5 });
    expect((await db.workoutSets.get(set.id))?.restStartedAt).toBeTruthy();
  });
});

describe('grouping carries from template into a session', () => {
  it('is preserved through getSessionDetail order', async () => {
    const { sessionId } = await buildSuperset();
    const detail = await getSessionDetail(sessionId);
    expect(detail?.exercises).toHaveLength(2);
    expect(detail?.exercises[0].sessionExercise.groupId).toBe(
      detail?.exercises[1].sessionExercise.groupId,
    );
  });
});
