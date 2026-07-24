import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import { addExerciseToTemplate } from '@/db/repositories/templates';
import { createPlan, getPlanWithDays } from '@/db/repositories/plans';
import {
  endDeloadEarly,
  getActiveDeload,
  startDeload,
} from '@/db/repositories/planDeload';
import { finishSession, startSessionFromTemplate } from '@/db/repositories/sessions';
import type { Exercise } from '@/types';

async function makeExercise(): Promise<Exercise> {
  return createExercise({
    name: 'Plank',
    primaryMuscleGroup: 'Core',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'duration',
    weightMode: 'none',
    weightMultiplier: 1,
    defaultRestSeconds: 60,
    notes: '',
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('startDeload', () => {
  it('creates a 7-day period with snapshotted reductions', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const period = await startDeload(plan.id, 'medium', new Date('2026-07-10T09:00:00'));
    expect(period.startDate).toBe('2026-07-10');
    expect(period.endDate).toBe('2026-07-16');
    expect(period.setReductionPercent).toBe(0.4);
  });

  it('refuses a second active deload', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    await startDeload(plan.id, 'light', new Date('2026-07-10T09:00:00'));
    await expect(
      startDeload(plan.id, 'strong', new Date('2026-07-12T09:00:00')),
    ).rejects.toThrow();
  });

  it('allows a new deload after the previous one ended', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    await startDeload(plan.id, 'light', new Date('2026-07-01T09:00:00'));
    // 2026-07-20 is past the first window (ended 2026-07-07).
    const second = await startDeload(plan.id, 'medium', new Date('2026-07-20T09:00:00'));
    expect(second.startDate).toBe('2026-07-20');
  });
});

describe('endDeloadEarly', () => {
  it('pulls the end day back to today so it is no longer active tomorrow', async () => {
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    await startDeload(plan.id, 'medium', new Date('2026-07-10T09:00:00'));
    await endDeloadEarly(plan.id, new Date('2026-07-12T09:00:00'));

    expect(
      await getActiveDeload(plan.id, new Date('2026-07-13T09:00:00')),
    ).toBeUndefined();
    const period = (
      await db.planDeloadPeriods.where('planId').equals(plan.id).toArray()
    )[0];
    expect(period.endDate).toBe('2026-07-12');
    expect(period.endedEarlyAt).toBeDefined();
  });
});

describe('session start during a deload', () => {
  it('marks the session and reduces sets and duration without touching the plan', async () => {
    const exercise = await makeExercise();
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const { days } = (await getPlanWithDays(plan.id))!;
    const row = await addExerciseToTemplate(days[0].id, exercise);
    // Default targets: 3 sets, 60 s duration.
    await startDeload(plan.id, 'medium'); // −40 % sets, −30 % duration

    const session = await startSessionFromTemplate(days[0].id);
    expect(session.deloadIntensity).toBe('medium');

    const se = (
      await db.sessionExercises.where('sessionId').equals(session.id).toArray()
    )[0];
    expect(se.targetSetsSnapshot).toBe(2); // 3 * 0.6 = 1.8 → 2
    expect(se.targetDurationSecondsSnapshot).toBe(42); // 60 * 0.7

    // The plan's stored template exercise is unchanged.
    const stored = await db.templateExercises.get(row.id);
    expect(stored?.targetSets).toBe(3);
    expect(stored?.targetDurationSeconds).toBe(60);

    await finishSession(session.id);
  });

  it('does not mark a normal session', async () => {
    const exercise = await makeExercise();
    const plan = await createPlan({ name: 'P', splitType: 'single' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await addExerciseToTemplate(days[0].id, exercise);

    const session = await startSessionFromTemplate(days[0].id);
    expect(session.deloadIntensity).toBeUndefined();
  });
});
