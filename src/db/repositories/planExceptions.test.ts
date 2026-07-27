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
    await setPlanException(plan.id, '2026-07-10', 'rest', { note: 'Reise' });

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

  it('stores the target date for a move and rejects a same-day move', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'move', { movedToDate: '2026-07-12' });
    const [exception] = await listPlanExceptions(plan.id);
    expect(exception).toMatchObject({ type: 'move', movedToDate: '2026-07-12' });

    await expect(
      setPlanException(plan.id, '2026-07-10', 'move', { movedToDate: '2026-07-10' }),
    ).rejects.toThrow();
  });

  it('clears the target date when a move becomes a skip', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'move', { movedToDate: '2026-07-12' });
    await setPlanException(plan.id, '2026-07-10', 'skip');
    const [exception] = await listPlanExceptions(plan.id);
    expect(exception.type).toBe('skip');
    expect(exception.movedToDate).toBeUndefined();
  });

  it('drops a plan’s exceptions when the plan is deleted', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: 'single' });
    await setPlanException(plan.id, '2026-07-10', 'skip');
    await deletePlan(plan.id);
    expect(await db.planScheduleExceptions.toArray()).toHaveLength(0);
  });
});
