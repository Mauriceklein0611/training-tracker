import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import { createPlan, getPlanWithDays } from '@/db/repositories/plans';
import {
  getTemplateWithExercises,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import {
  addExerciseToWorkoutUnit,
  addWorkoutUnitToPlan,
  createWorkoutUnit,
  deleteWorkoutUnit,
  duplicateWorkoutUnit,
  getWorkoutUnitWithExercises,
  listWorkoutUnits,
  saveTemplateAsWorkoutUnit,
  updateWorkoutUnit,
  updateWorkoutUnitExercise,
} from '@/db/repositories/workoutUnits';
import { finishSession, startSessionFromWorkoutUnit } from '@/db/repositories/sessions';
import type { Exercise } from '@/types';

async function makeExerciseRow(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: name,
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 90,
    notes: '',
  });
}

/** A unit "Push" with bench press and shoulder press. */
async function seedPushUnit() {
  const bench = await makeExerciseRow('Bankdrücken');
  const press = await makeExerciseRow('Schulterdrücken');
  const unit = await createWorkoutUnit({ name: 'Push', description: 'Druck' });
  await addExerciseToWorkoutUnit(unit.id, bench);
  await addExerciseToWorkoutUnit(unit.id, press);
  return { unit, bench, press };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('unit CRUD', () => {
  it('creates a unit and keeps its exercises in insertion order', async () => {
    const { unit, bench, press } = await seedPushUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    expect(detail.exercises.map((e) => e.exerciseId)).toEqual([bench.id, press.id]);
    expect(detail.exercises.map((e) => e.order)).toEqual([0, 1]);
  });

  it('hides archived units from the default list but keeps them with the flag', async () => {
    const { unit } = await seedPushUnit();
    await updateWorkoutUnit(unit.id, { archived: true });
    expect(await listWorkoutUnits()).toHaveLength(0);
    expect(await listWorkoutUnits(true)).toHaveLength(1);
  });

  it('duplicates a unit with its exercises but a fresh identity', async () => {
    const { unit } = await seedPushUnit();
    const copy = await duplicateWorkoutUnit(unit.id);
    expect(copy.id).not.toBe(unit.id);
    expect(copy.name).toBe('Push (Kopie)');
    const detail = (await getWorkoutUnitWithExercises(copy.id))!;
    expect(detail.exercises).toHaveLength(2);
  });
});

describe('copy-on-add to plans', () => {
  it('adds a unit to two plans as independent copies that record their source', async () => {
    const { unit } = await seedPushUnit();
    const planA = await createPlan({ name: 'Plan A', splitType: 'single' });
    const planB = await createPlan({ name: 'Plan B', splitType: 'single' });

    const dayA = await addWorkoutUnitToPlan(unit.id, planA.id);
    const dayB = await addWorkoutUnitToPlan(unit.id, planB.id);

    expect(dayA.sourceWorkoutUnitTemplateId).toBe(unit.id);
    expect(dayA.sourceWorkoutUnitNameSnapshot).toBe('Push');
    // Days are distinct rows appended at the end of each plan.
    expect(dayA.id).not.toBe(dayB.id);

    const withA = (await getTemplateWithExercises(dayA.id))!;
    const withB = (await getTemplateWithExercises(dayB.id))!;
    expect(withA.exercises).toHaveLength(2);
    expect(withB.exercises).toHaveLength(2);
    // The copies share no template-exercise rows.
    const idsA = new Set(withA.exercises.map((e) => e.id));
    expect(withB.exercises.some((e) => idsA.has(e.id))).toBe(false);
  });

  it('does not change existing plan copies when the library unit is edited later', async () => {
    const { unit } = await seedPushUnit();
    const plan = await createPlan({ name: 'Plan', splitType: 'single' });
    const day = await addWorkoutUnitToPlan(unit.id, plan.id);

    // Edit the library unit after the copy was made.
    const unitDetail = (await getWorkoutUnitWithExercises(unit.id))!;
    await updateWorkoutUnitExercise(unitDetail.exercises[0].id, { targetSets: 8 });
    await updateWorkoutUnit(unit.id, { name: 'Push v2' });

    const dayDetail = (await getTemplateWithExercises(day.id))!;
    expect(dayDetail.template.name).toBe('Push'); // unchanged
    expect(dayDetail.exercises[0].targetSets).toBe(3); // unchanged
  });

  it('keeps the two plan copies independent of each other', async () => {
    const { unit } = await seedPushUnit();
    const planA = await createPlan({ name: 'A', splitType: 'single' });
    const planB = await createPlan({ name: 'B', splitType: 'single' });
    const dayA = await addWorkoutUnitToPlan(unit.id, planA.id);
    const dayB = await addWorkoutUnitToPlan(unit.id, planB.id);

    const detailA = (await getTemplateWithExercises(dayA.id))!;
    await updateTemplateExercise(detailA.exercises[0].id, { targetSets: 10 });

    const afterB = (await getTemplateWithExercises(dayB.id))!;
    expect(afterB.exercises[0].targetSets).toBe(3);
  });
});

describe('direct start without a plan', () => {
  it('snapshots the unit id and name and leaves planId empty', async () => {
    const { unit } = await seedPushUnit();
    const session = await startSessionFromWorkoutUnit(unit.id);

    expect(session.planId).toBeUndefined();
    expect(session.workoutUnitTemplateId).toBe(unit.id);
    expect(session.workoutUnitNameSnapshot).toBe('Push');
    const rows = await db.sessionExercises
      .where('sessionId')
      .equals(session.id)
      .toArray();
    expect(rows).toHaveLength(2);

    // Completing it must not throw despite the absent plan.
    await finishSession(session.id);
    expect((await db.workoutSessions.get(session.id))?.status).toBe('completed');
  });
});

describe('deletion safety', () => {
  it('deleting a unit keeps plan copies and history intact', async () => {
    const { unit } = await seedPushUnit();
    const plan = await createPlan({ name: 'Plan', splitType: 'single' });
    const day = await addWorkoutUnitToPlan(unit.id, plan.id);
    const session = await startSessionFromWorkoutUnit(unit.id);
    await finishSession(session.id);

    await deleteWorkoutUnit(unit.id);

    expect(await db.workoutUnitTemplates.get(unit.id)).toBeUndefined();
    // The plan day copy and the completed session survive.
    const dayDetail = await getTemplateWithExercises(day.id);
    expect(dayDetail?.exercises).toHaveLength(2);
    expect((await db.workoutSessions.get(session.id))?.status).toBe('completed');
  });
});

describe('save a plan day as a library unit', () => {
  it('creates an independent unit from a plan day', async () => {
    const bench = await makeExerciseRow('Bankdrücken');
    const plan = await createPlan({ name: 'Plan', splitType: 'single' });
    const { days } = (await getPlanWithDays(plan.id))!;
    const { addExerciseToTemplate } = await import('@/db/repositories/templates');
    await addExerciseToTemplate(days[0].id, bench);

    const unit = await saveTemplateAsWorkoutUnit(days[0].id);
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    expect(detail.exercises).toHaveLength(1);
    expect(detail.exercises[0].exerciseId).toBe(bench.id);
  });
});
