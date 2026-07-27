import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createPlan, deletePlan } from '@/db/repositories/plans';
import {
  clearPlanException,
  listPlanExceptions,
  setPlanException,
} from '@/db/repositories/planExceptions';

beforeEach(async () => {
  await resetDatabase();
});

describe('plan schedule exceptions', () => {
  it('creates an exception for a day and lists it', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'skip');

    const list = await listPlanExceptions(plan.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ date: '2026-07-10', type: 'skip' });
  });

  it('updates the existing exception in place instead of duplicating a day', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'skip');
    await setPlanException(plan.id, '2026-07-10', 'rest', 'Reise');

    const list = await listPlanExceptions(plan.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'rest', note: 'Reise' });
  });

  it('clears an exception for a day', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'skip');
    await clearPlanException(plan.id, '2026-07-10');
    expect(await listPlanExceptions(plan.id)).toHaveLength(0);
  });

  it('returns exceptions ordered by date', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-12', 'skip');
    await setPlanException(plan.id, '2026-07-03', 'rest');
    expect((await listPlanExceptions(plan.id)).map((e) => e.date)).toEqual([
      '2026-07-03',
      '2026-07-12',
    ]);
  });

  it('drops a plan’s exceptions when the plan is deleted', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'skip');
    await deletePlan(plan.id);
    expect(await db.planScheduleExceptions.toArray()).toHaveLength(0);
  });
});
