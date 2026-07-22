import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  getSessionDetail,
  startFreeSession,
  startSessionFromTemplate,
} from '@/db/repositories/sessions';
import { updateSettings } from '@/db/repositories/settings';
import { FALLBACK_REST_SECONDS, resolveRestSeconds } from '@/services/rest';
import { resetDatabase } from '@/tests/dbTestUtils';

const BASE = {
  primaryMuscleGroup: 'Brust',
  secondaryMuscleGroups: [],
  equipment: 'Langhantel',
  trackingType: 'weight_reps' as const,
  weightMode: 'total' as const,
  weightMultiplier: 1,
  notes: '',
};

beforeEach(async () => {
  await resetDatabase();
});

describe('resolveRestSeconds', () => {
  it('prefers the plan target over everything else', () => {
    expect(
      resolveRestSeconds({
        templateRestSeconds: 180,
        exerciseDefaultRestSeconds: 90,
        globalDefaultRestSeconds: 120,
      }),
    ).toBe(180);
  });

  it('falls back to the exercise default when the plan has none', () => {
    expect(
      resolveRestSeconds({
        exerciseDefaultRestSeconds: 90,
        globalDefaultRestSeconds: 120,
      }),
    ).toBe(90);
  });

  it('falls back to the global default when the exercise has none', () => {
    expect(resolveRestSeconds({ globalDefaultRestSeconds: 150 })).toBe(150);
  });

  it('uses the constant fallback when nothing is configured', () => {
    expect(resolveRestSeconds({})).toBe(FALLBACK_REST_SECONDS);
  });

  it('treats an explicit zero as a real value, not as "unset"', () => {
    // A deliberate "no rest" must not fall through to the next level.
    expect(
      resolveRestSeconds({ templateRestSeconds: 0, exerciseDefaultRestSeconds: 90 }),
    ).toBe(0);
    expect(
      resolveRestSeconds({
        exerciseDefaultRestSeconds: 0,
        globalDefaultRestSeconds: 120,
      }),
    ).toBe(0);
  });

  it('skips null and undefined levels', () => {
    expect(
      resolveRestSeconds({
        templateRestSeconds: null,
        exerciseDefaultRestSeconds: undefined,
        globalDefaultRestSeconds: 100,
      }),
    ).toBe(100);
  });
});

describe('rest snapshot when an exercise joins a workout', () => {
  it('uses the exercise default in a free workout', async () => {
    await updateSettings({ defaultRestSeconds: 120 });
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 45,
    });

    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);

    // Before the fix this was the global 120, ignoring the exercise setting.
    expect(sessionExercise.restSecondsSnapshot).toBe(45);
  });

  it('uses the global default when the exercise has none of its own', async () => {
    await updateSettings({ defaultRestSeconds: 150 });
    // 0 would be a deliberate choice, so use a fresh exercise with the global value.
    const exercise = await createExercise({
      ...BASE,
      name: 'Rudern',
      defaultRestSeconds: 150,
    });

    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);

    expect(sessionExercise.restSecondsSnapshot).toBe(150);
  });

  it('prefers the plan target over the exercise default', async () => {
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 45,
    });
    const template = await createTemplate('Push');
    const row = await addExerciseToTemplate(template.id, exercise);
    await updateTemplateExercise(row.id, { restSeconds: 210, targetSets: 4 });

    const session = await startSessionFromTemplate(template.id);
    const detail = await getSessionDetail(session.id);

    expect(detail?.exercises[0].sessionExercise.restSecondsSnapshot).toBe(210);
    expect(detail?.exercises[0].sessionExercise.targetSetsSnapshot).toBe(4);
  });

  it('leaves the set goal undefined for a free workout', async () => {
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 60,
    });
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);

    expect(sessionExercise.targetSetsSnapshot).toBeUndefined();
  });

  it('does not change a running workout when the exercise is edited later', async () => {
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 45,
    });
    const session = await startFreeSession();
    await addExerciseToSession(session.id, exercise);

    await updateExercise(exercise.id, { defaultRestSeconds: 300 });

    const detail = await getSessionDetail(session.id);
    // The snapshot is what the workout was started with.
    expect(detail?.exercises[0].sessionExercise.restSecondsSnapshot).toBe(45);
    expect((await db.exercises.get(exercise.id))?.defaultRestSeconds).toBe(300);
  });

  it('keeps recorded sets untouched when the exercise default changes', async () => {
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 45,
    });
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);

    const set = await addSet(sessionExercise.id, {
      restTargetSeconds: sessionExercise.restSecondsSnapshot,
    });
    await completeSet(set.id, { weightKg: 80, reps: 8 });

    await updateExercise(exercise.id, { defaultRestSeconds: 300 });

    expect((await db.workoutSets.get(set.id))?.restTargetSeconds).toBe(45);
  });

  it('carries the snapshot into a workout repeated from an earlier one', async () => {
    const exercise = await createExercise({
      ...BASE,
      name: 'Bankdrücken',
      defaultRestSeconds: 75,
    });
    const session = await startFreeSession();
    await addExerciseToSession(session.id, exercise);

    const detail = await getSessionDetail(session.id);
    expect(detail?.exercises[0].sessionExercise.restSecondsSnapshot).toBe(75);
  });
});
