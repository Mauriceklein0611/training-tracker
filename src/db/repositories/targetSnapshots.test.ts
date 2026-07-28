import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { getSessionDetail, startSessionFromTemplate } from '@/db/repositories/sessions';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(): Promise<Exercise> {
  return createExercise({
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('target snapshots frozen at start', () => {
  it('gives the same exercise at two plan positions its own targets', async () => {
    const template = await createTemplate('Plan');
    const exercise = await makeExerciseRow();
    const rowA = await addExerciseToTemplate(template.id, exercise);
    const rowB = await addExerciseToTemplate(template.id, exercise);
    await updateTemplateExercise(rowA.id, {
      targetSets: 3,
      targetRepMin: 8,
      targetRepMax: 12,
    });
    await updateTemplateExercise(rowB.id, {
      targetSets: 5,
      targetRepMin: 3,
      targetRepMax: 5,
    });

    const session = await startSessionFromTemplate(template.id);
    const detail = await getSessionDetail(session.id);
    const [first, second] = detail!.exercises;

    expect(first.sessionExercise.targetRepMinSnapshot).toBe(8);
    expect(first.sessionExercise.targetRepMaxSnapshot).toBe(12);
    expect(first.sessionExercise.targetSetsSnapshot).toBe(3);

    expect(second.sessionExercise.targetRepMinSnapshot).toBe(3);
    expect(second.sessionExercise.targetRepMaxSnapshot).toBe(5);
    expect(second.sessionExercise.targetSetsSnapshot).toBe(5);

    // Each position remembers which plan row it came from.
    expect(first.sessionExercise.templateExerciseIdSnapshot).toBe(rowA.id);
    expect(second.sessionExercise.templateExerciseIdSnapshot).toBe(rowB.id);
  });

  it('freezes cardio targets (distance, RPE, intervals) at start', async () => {
    const template = await createTemplate('Cardio-Plan');
    const running = await createExercise({
      name: 'Laufen',
      primaryMuscleGroup: 'Ganzkörper',
      secondaryMuscleGroups: [],
      equipment: '',
      defaultEquipment: 'treadmill',
      trackingType: 'cardio',
      cardioModality: 'running',
      weightMode: 'none',
      weightMultiplier: 1,
      defaultRestSeconds: 60,
      notes: '',
    });
    const row = await addExerciseToTemplate(template.id, running);
    await updateTemplateExercise(row.id, {
      targetSets: 4,
      targetDurationSeconds: 600,
      targetDistanceMeters: 2000,
      targetRpe: 7,
    });

    const session = await startSessionFromTemplate(template.id);
    const detail = await getSessionDetail(session.id);
    const snapshot = detail!.exercises[0].sessionExercise;

    expect(snapshot.cardioModalitySnapshot).toBe('running');
    expect(snapshot.targetSetsSnapshot).toBe(4);
    expect(snapshot.targetDurationSecondsSnapshot).toBe(600);
    expect(snapshot.targetDistanceMetersSnapshot).toBe(2000);
    expect(snapshot.targetRpeSnapshot).toBe(7);

    // A later plan edit does not change the running workout.
    await updateTemplateExercise(row.id, { targetDistanceMeters: 9000 });
    const after = await getSessionDetail(session.id);
    expect(after!.exercises[0].sessionExercise.targetDistanceMetersSnapshot).toBe(2000);
  });

  it('does not change a running workout when the plan is edited afterwards', async () => {
    const template = await createTemplate('Plan');
    const exercise = await makeExerciseRow();
    const row = await addExerciseToTemplate(template.id, exercise);
    await updateTemplateExercise(row.id, {
      targetSets: 3,
      targetRepMin: 8,
      targetRepMax: 12,
    });

    const session = await startSessionFromTemplate(template.id);

    // Edit the plan while the workout is under way.
    await updateTemplateExercise(row.id, {
      targetSets: 6,
      targetRepMin: 4,
      targetRepMax: 6,
    });

    const detail = await getSessionDetail(session.id);
    const snapshot = detail!.exercises[0].sessionExercise;
    expect(snapshot.targetSetsSnapshot).toBe(3);
    expect(snapshot.targetRepMinSnapshot).toBe(8);
    expect(snapshot.targetRepMaxSnapshot).toBe(12);
  });
});
