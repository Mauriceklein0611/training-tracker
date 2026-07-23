import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createPlan, deletePlan } from '@/db/repositories/plans';
import {
  activatePlan,
  deactivatePlan,
  getActivePlanId,
  getOpenUsagePeriod,
  listUsagePeriods,
  updateUsagePeriod,
} from '@/db/repositories/planUsage';

beforeEach(async () => {
  await resetDatabase();
});

describe('activatePlan', () => {
  it('opens a usage period and marks the plan active', async () => {
    const plan = await createPlan({ name: 'A', splitType: 'single' });
    await activatePlan(plan.id, new Date('2026-07-10T09:00:00'));

    expect(await getActivePlanId()).toBe(plan.id);
    const open = await getOpenUsagePeriod(plan.id);
    expect(open?.startDate).toBe('2026-07-10');
    expect(open?.endDate).toBeUndefined();
    expect(open?.planNameSnapshot).toBe('A');
  });

  it('is idempotent for the already-active plan', async () => {
    const plan = await createPlan({ name: 'A', splitType: 'single' });
    await activatePlan(plan.id, new Date('2026-07-10T09:00:00'));
    await activatePlan(plan.id, new Date('2026-07-12T09:00:00'));

    expect(await listUsagePeriods(plan.id)).toHaveLength(1);
  });

  it('closes the previous plan period when switching plans', async () => {
    const a = await createPlan({ name: 'A', splitType: 'single' });
    const b = await createPlan({ name: 'B', splitType: 'single' });
    await activatePlan(a.id, new Date('2026-07-10T09:00:00'));
    await activatePlan(b.id, new Date('2026-07-20T09:00:00'));

    expect(await getActivePlanId()).toBe(b.id);
    const aPeriods = await listUsagePeriods(a.id);
    expect(aPeriods).toHaveLength(1);
    expect(aPeriods[0].endDate).toBe('2026-07-20');
    const bOpen = await getOpenUsagePeriod(b.id);
    expect(bOpen?.startDate).toBe('2026-07-20');
    expect(bOpen?.endDate).toBeUndefined();
  });
});

describe('deactivatePlan', () => {
  it('closes the open period and clears the active plan', async () => {
    const plan = await createPlan({ name: 'A', splitType: 'single' });
    await activatePlan(plan.id, new Date('2026-07-10T09:00:00'));
    await deactivatePlan(new Date('2026-07-15T09:00:00'));

    expect(await getActivePlanId()).toBeUndefined();
    expect(await getOpenUsagePeriod(plan.id)).toBeUndefined();
    expect((await listUsagePeriods(plan.id))[0].endDate).toBe('2026-07-15');
  });
});

describe('deletePlan keeps usage history', () => {
  it('closes the open period, clears active, but keeps the periods readable', async () => {
    const plan = await createPlan({ name: 'Muskelaufbau', splitType: 'single' });
    await activatePlan(plan.id, new Date('2026-07-10T09:00:00'));

    await deletePlan(plan.id);

    expect(await getActivePlanId()).toBeUndefined();
    const periods = await listUsagePeriods(plan.id);
    expect(periods).toHaveLength(1);
    // Snapshot keeps it attributable even though the plan is gone.
    expect(periods[0].planNameSnapshot).toBe('Muskelaufbau');
    expect(periods[0].endDate).toBeDefined();
  });
});

describe('manual correction', () => {
  it('updates a period date', async () => {
    const plan = await createPlan({ name: 'A', splitType: 'single' });
    await activatePlan(plan.id, new Date('2026-07-10T09:00:00'));
    const open = (await getOpenUsagePeriod(plan.id))!;
    await updateUsagePeriod(open.id, { startDate: '2026-07-01' });
    expect((await db.planUsagePeriods.get(open.id))?.startDate).toBe('2026-07-01');
  });
});
