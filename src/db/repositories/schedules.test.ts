import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '@/tests/dbTestUtils';
import {
  addDay,
  createPlan,
  deleteDay,
  duplicatePlan,
  getPlanWithDays,
} from '@/db/repositories/plans';
import {
  addCycleEntry,
  advancePlanCursor,
  deleteCycleEntry,
  duplicateCycleEntry,
  ensureSchedule,
  getEntries,
  getPlanScheduleState,
  getPlanScheduleView,
  moveCycleEntry,
  resetCycle,
  setScheduleMode,
  setWeekdayAssignment,
} from '@/db/repositories/schedules';

beforeEach(async () => {
  await resetDatabase();
});

describe('default schedule', () => {
  it('is created for a new plan as free-rotation without entries', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const view = await getPlanScheduleView(plan.id);
    expect(view.schedule.mode).toBe('free-rotation');
    expect(view.entries).toHaveLength(0);
    expect(view.units).toHaveLength(3);
  });

  it('derives the free-rotation order from the units', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    const state = await getPlanScheduleState(plan.id);
    expect(state.upcoming.map((r) => r.template?.id)).toEqual(days.map((d) => d.id));
  });
});

describe('mode switching', () => {
  it('seeds a repeating cycle with one workout entry per unit', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    const view = await getPlanScheduleView(plan.id);
    expect(view.schedule.mode).toBe('repeating-cycle');
    expect(view.entries).toHaveLength(3);
    expect(view.entries.every((e) => e.type === 'workout')).toBe(true);
    expect(view.schedule.cyclePosition).toBe(0);
  });

  it('starts weekly with no assignments', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '3-day' });
    await setScheduleMode(plan.id, 'weekly');
    const view = await getPlanScheduleView(plan.id);
    expect(view.schedule.mode).toBe('weekly');
    expect(view.entries).toHaveLength(0);
  });

  it('drops entries when switching back to free-rotation', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    await setScheduleMode(plan.id, 'free-rotation');
    const view = await getPlanScheduleView(plan.id);
    expect(view.entries).toHaveLength(0);
    expect(view.schedule.cyclePosition).toBeUndefined();
  });
});

describe('repeating-cycle editing', () => {
  it('appends, moves, duplicates and deletes entries with dense positions', async () => {
    const plan = await createPlan({ name: 'Zyklus', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    const schedule = await ensureSchedule(plan.id);

    await addCycleEntry(plan.id, { type: 'rest', label: 'Pause' });
    let entries = await getEntries(schedule.id);
    expect(entries.map((e) => e.type)).toEqual(['workout', 'workout', 'rest']);
    expect(entries.map((e) => e.position)).toEqual([0, 1, 2]);

    // Move the rest day up one slot.
    await moveCycleEntry(entries[2].id, -1);
    entries = await getEntries(schedule.id);
    expect(entries.map((e) => e.type)).toEqual(['workout', 'rest', 'workout']);

    // Duplicate the rest day right after itself.
    await duplicateCycleEntry(entries[1].id);
    entries = await getEntries(schedule.id);
    expect(entries.map((e) => e.type)).toEqual(['workout', 'rest', 'rest', 'workout']);
    expect(entries.map((e) => e.position)).toEqual([0, 1, 2, 3]);

    // Delete one rest day; positions stay dense.
    await deleteCycleEntry(entries[1].id);
    entries = await getEntries(schedule.id);
    expect(entries.map((e) => e.type)).toEqual(['workout', 'rest', 'workout']);
    expect(entries.map((e) => e.position)).toEqual([0, 1, 2]);
  });

  it('advances the cursor and wraps around', async () => {
    const plan = await createPlan({ name: 'Zyklus', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle'); // 2 entries
    await advancePlanCursor(plan.id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(1);
    await advancePlanCursor(plan.id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(0);
  });

  it('resets the cycle', async () => {
    const plan = await createPlan({ name: 'Zyklus', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    await resetCycle(plan.id);
    const view = await getPlanScheduleView(plan.id);
    expect(view.entries).toHaveLength(0);
    expect(view.schedule.cyclePosition).toBe(0);
  });
});

describe('weekly assignment', () => {
  it('pins a unit to a weekday and replaces it, and clears it', async () => {
    const plan = await createPlan({ name: 'Woche', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await setScheduleMode(plan.id, 'weekly');

    await setWeekdayAssignment(plan.id, 0, { type: 'workout', templateId: days[0].id });
    let view = await getPlanScheduleView(plan.id);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].weekday).toBe(0);
    expect(view.entries[0].templateId).toBe(days[0].id);

    // Reassigning the same weekday replaces, never duplicates.
    await setWeekdayAssignment(plan.id, 0, { type: 'rest' });
    view = await getPlanScheduleView(plan.id);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].type).toBe('rest');

    // Clearing removes the entry.
    await setWeekdayAssignment(plan.id, 0, null);
    view = await getPlanScheduleView(plan.id);
    expect(view.entries).toHaveLength(0);
  });
});

describe('lifecycle integration', () => {
  it('removes cycle entries that reference a deleted unit and re-densifies', async () => {
    const plan = await createPlan({ name: 'Zyklus', splitType: '3-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await setScheduleMode(plan.id, 'repeating-cycle'); // 3 workout entries
    const schedule = await ensureSchedule(plan.id);

    await deleteDay(days[1].id);
    const entries = await getEntries(schedule.id);
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.templateId === days[1].id)).toBe(false);
    expect(entries.map((e) => e.position)).toEqual([0, 1]);
  });

  it('copies the schedule with remapped unit references when a plan is duplicated', async () => {
    const plan = await createPlan({ name: 'Zyklus', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    await addCycleEntry(plan.id, { type: 'rest' });

    const copy = await duplicatePlan(plan.id);
    const copyView = await getPlanScheduleView(copy.id);
    const copyUnitIds = new Set(copyView.units.map((u) => u.id));

    expect(copyView.schedule.mode).toBe('repeating-cycle');
    expect(copyView.entries).toHaveLength(3);
    // Every workout entry points at a unit of the *copy*, not the original.
    for (const entry of copyView.entries) {
      if (entry.type === 'workout') expect(copyUnitIds.has(entry.templateId!)).toBe(true);
    }
  });

  it('does not place a newly added unit into a weekly plan automatically', async () => {
    const plan = await createPlan({ name: 'Woche', splitType: '2-day' });
    await setScheduleMode(plan.id, 'weekly');
    await addDay(plan.id, 'Extra');
    const view = await getPlanScheduleView(plan.id);
    expect(view.units).toHaveLength(3);
    expect(view.entries).toHaveLength(0);
  });
});
