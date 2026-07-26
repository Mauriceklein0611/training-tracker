import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  getTemplateWithExercises,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { finishSession, startSessionFromTemplate } from '@/db/repositories/sessions';
import {
  addDay,
  copyExerciseToDay,
  createPlan,
  deleteDay,
  duplicateDay,
  duplicatePlan,
  getPlanWithDays,
  LastDayError,
  moveDay,
  moveExerciseToDay,
  nextDayForPlan,
  setPlanDeload,
} from '@/db/repositories/plans';
import { updateTemplate } from '@/db/repositories/templates';

beforeEach(async () => {
  await resetDatabase();
});

async function anExercise(name: string) {
  return createExercise({
    name,
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

describe('createPlan', () => {
  it('creates one day per split type with ordered default names', async () => {
    const plan = await createPlan({ name: 'Muskelaufbau', splitType: '3-day' });
    const withDays = await getPlanWithDays(plan.id);
    expect(withDays?.plan.splitType).toBe('3-day');
    expect(withDays?.days.map((day) => day.name)).toEqual(['Tag A', 'Tag B', 'Tag C']);
    expect(withDays?.days.map((day) => day.position)).toEqual([0, 1, 2]);
  });

  it('uses structure-template day names when given', async () => {
    const plan = await createPlan({
      name: 'PPL',
      splitType: '3-day',
      dayNames: ['Push', 'Pull', 'Beine'],
    });
    const withDays = await getPlanWithDays(plan.id);
    expect(withDays?.days.map((day) => day.name)).toEqual(['Push', 'Pull', 'Beine']);
  });

  it('always keeps at least one day', async () => {
    const plan = await createPlan({ name: 'Custom', splitType: 'custom' });
    const withDays = await getPlanWithDays(plan.id);
    expect(withDays?.days).toHaveLength(1);
  });
});

describe('day management', () => {
  it('adds, renames and reorders days', async () => {
    const plan = await createPlan({ name: 'P', splitType: '2-day' });
    const day = await addDay(plan.id, 'Extra');
    expect(day.position).toBe(2);

    await updateTemplate(day.id, { name: 'Umbenannt' });
    await moveDay(day.id, -1); // move C up to position 1

    const withDays = await getPlanWithDays(plan.id);
    expect(withDays?.days.map((entry) => entry.name)).toEqual([
      'Tag A',
      'Umbenannt',
      'Tag B',
    ]);
    expect(withDays?.days.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it('duplicates a day with its exercises, appended at the end', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const [dayA] = (await getPlanWithDays(plan.id))!.days;
    await addExerciseToTemplate(dayA.id, await anExercise('Bank'));

    const copy = await duplicateDay(dayA.id);
    expect(copy.name).toBe('Tag A (Kopie)');
    expect(copy.position).toBe(1);
    const copyRows = await getTemplateWithExercises(copy.id);
    expect(copyRows?.exercises).toHaveLength(1);
  });

  it('refuses to delete the last day but allows deleting others', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const [only] = (await getPlanWithDays(plan.id))!.days;
    await expect(deleteDay(only.id)).rejects.toBeInstanceOf(LastDayError);

    const second = await addDay(plan.id);
    await deleteDay(second.id);
    expect((await getPlanWithDays(plan.id))!.days).toHaveLength(1);
  });
});

describe('duplicatePlan', () => {
  it('copies every day and exercise with fresh ids', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const days = (await getPlanWithDays(plan.id))!.days;
    await addExerciseToTemplate(days[0].id, await anExercise('Bank'));

    const copy = await duplicatePlan(plan.id);
    expect(copy.id).not.toBe(plan.id);
    const copyDays = (await getPlanWithDays(copy.id))!.days;
    expect(copyDays).toHaveLength(3);
    expect(copyDays.map((day) => day.id)).not.toContain(days[0].id);
    const firstCopyRows = await getTemplateWithExercises(copyDays[0].id);
    expect(firstCopyRows?.exercises).toHaveLength(1);
  });
});

describe('moving exercises between days', () => {
  it('moves an exercise to another day and re-densifies the source order', async () => {
    const plan = await createPlan({ name: 'P', splitType: '2-day' });
    const [dayA, dayB] = (await getPlanWithDays(plan.id))!.days;
    await addExerciseToTemplate(dayA.id, await anExercise('Bank'));
    const rowB = await addExerciseToTemplate(dayA.id, await anExercise('Rudern'));

    await moveExerciseToDay(rowB.id, dayB.id);

    const a = await getTemplateWithExercises(dayA.id);
    const b = await getTemplateWithExercises(dayB.id);
    expect(a?.exercises.map((row) => row.exercise?.name)).toEqual(['Bank']);
    expect(b?.exercises.map((row) => row.exercise?.name)).toEqual(['Rudern']);
    expect(a?.exercises[0].order).toBe(0);
  });

  it('copies an exercise to another day, leaving the source intact', async () => {
    const plan = await createPlan({ name: 'P', splitType: '2-day' });
    const [dayA, dayB] = (await getPlanWithDays(plan.id))!.days;
    const row = await addExerciseToTemplate(dayA.id, await anExercise('Bank'));

    await copyExerciseToDay(row.id, dayB.id);

    expect((await getTemplateWithExercises(dayA.id))?.exercises).toHaveLength(1);
    expect((await getTemplateWithExercises(dayB.id))?.exercises).toHaveLength(1);
  });
});

describe('nextDayForPlan rotation', () => {
  async function completeDay(dayId: string) {
    const session = await startSessionFromTemplate(dayId);
    await finishSession(session.id);
  }

  it('suggests the first day when nothing was completed yet', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const days = (await getPlanWithDays(plan.id))!.days;
    expect((await nextDayForPlan(plan.id))?.id).toBe(days[0].id);
  });

  it('advances through the days and wraps around', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const days = (await getPlanWithDays(plan.id))!.days;

    await completeDay(days[0].id);
    expect((await nextDayForPlan(plan.id))?.id).toBe(days[1].id);
    await completeDay(days[1].id);
    expect((await nextDayForPlan(plan.id))?.id).toBe(days[2].id);
    await completeDay(days[2].id);
    expect((await nextDayForPlan(plan.id))?.id).toBe(days[0].id);
  });

  it('is not advanced by an active (unfinished) session', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const days = (await getPlanWithDays(plan.id))!.days;
    await completeDay(days[0].id);
    // Start day B but leave it running.
    await startSessionFromTemplate(days[1].id);
    expect((await nextDayForPlan(plan.id))?.id).toBe(days[1].id);
  });

  it('falls back to the former position when the trained day was deleted', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const days = (await getPlanWithDays(plan.id))!.days;
    await completeDay(days[1].id); // trained the middle day
    await deleteDay(days[1].id); // then removed it

    const next = await nextDayForPlan(plan.id);
    // Position 1 now holds the former day C, a valid forward suggestion.
    expect(next?.id).toBe(days[2].id);
  });
});

describe('legacy plan-level deload (removed in Phase 8)', () => {
  it('is inert — the old deloadIntensity field no longer affects a session start', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const [day] = (await getPlanWithDays(plan.id))!.days;
    const row = await addExerciseToTemplate(day.id, await anExercise('Bank'));
    await updateTemplateExercise(row.id, { targetSets: 4 });

    // Setting the legacy field must have no effect: the time-boxed
    // PlanDeloadPeriod (Phase 5) is the only deload path now.
    await setPlanDeload(plan.id, 'medium');
    const session = await startSessionFromTemplate(day.id);
    const sessionExercises = await db.sessionExercises
      .where('sessionId')
      .equals(session.id)
      .toArray();
    expect(sessionExercises[0].targetSetsSnapshot).toBe(4); // unchanged
    expect(session.deloadIntensity).toBeUndefined();
    // The stored plan row is untouched either way.
    expect((await db.templateExercises.get(row.id))?.targetSets).toBe(4);
  });
});
