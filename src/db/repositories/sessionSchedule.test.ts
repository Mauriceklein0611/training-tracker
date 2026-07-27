import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createPlan, deletePlan, getPlanWithDays } from '@/db/repositories/plans';
import {
  addCycleEntry,
  ensureSchedule,
  getPlanScheduleState,
  setScheduleMode,
} from '@/db/repositories/schedules';
import {
  finishSession,
  startFreeSession,
  startSessionFromPreviousSession,
  startSessionFromTemplate,
} from '@/db/repositories/sessions';
import { db } from '@/db/db';

beforeEach(async () => {
  await resetDatabase();
});

/**
 * Phase 0.1 — completing a workout must move the plan's schedule forward exactly
 * once, only on the active→completed transition, and only for the mode that
 * carries a cursor (repeating-cycle). Phase 0.3 — repeating an earlier workout
 * must carry its plan attribution.
 */
describe('schedule advance on completion (0.1)', () => {
  it('advances a repeating cycle to the next day and is idempotent', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await setScheduleMode(plan.id, 'repeating-cycle'); // 2 workout entries
    await addCycleEntry(plan.id, { type: 'rest', label: 'Pause' }); // + a rest day

    // Cursor starts on day 0; that is what the schedule suggests.
    let state = await getPlanScheduleState(plan.id);
    expect(state.current?.template?.id).toBe(days[0].id);
    expect(state.nextWorkout?.template?.id).toBe(days[0].id);

    const session = await startSessionFromTemplate(days[0].id);
    await finishSession(session.id);

    // Completing day 0 moves the cursor to day 1.
    state = await getPlanScheduleState(plan.id);
    expect(state.current?.template?.id).toBe(days[1].id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(1);

    // A second completion of the same (already finished) session is a no-op.
    await finishSession(session.id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(1);
    state = await getPlanScheduleState(plan.id);
    expect(state.current?.template?.id).toBe(days[1].id);
  });

  it('steps the cursor through a full cycle including its rest day', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await setScheduleMode(plan.id, 'repeating-cycle');
    await addCycleEntry(plan.id, { type: 'rest' }); // [day0, day1, rest]

    const first = await startSessionFromTemplate(days[0].id);
    await finishSession(first.id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(1);

    // Completing day1 lands the cursor on the rest day at position 2.
    const second = await startSessionFromTemplate(days[1].id);
    await finishSession(second.id);
    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(2);
  });

  it('does not create or move a cursor for free-rotation, but advances the suggestion', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    // Default mode is free-rotation (no stored cursor).
    const session = await startSessionFromTemplate(days[0].id);
    await finishSession(session.id);

    // Free-rotation keeps no cursor; the next suggestion is derived from history.
    expect((await ensureSchedule(plan.id)).cyclePosition).toBeUndefined();
    const state = await getPlanScheduleState(plan.id);
    expect(state.nextWorkout?.template?.id).toBe(days[1].id);
  });

  it('leaves a plan schedule untouched for a free workout', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    const before = (await ensureSchedule(plan.id)).cyclePosition;

    const free = await startFreeSession('Freies Training');
    await finishSession(free.id); // no planId — must not throw or advance

    expect((await ensureSchedule(plan.id)).cyclePosition).toBe(before);
  });
});

describe('repeat previous workout carries plan attribution (0.3)', () => {
  it('copies planId, plan name and day position snapshots', async () => {
    const plan = await createPlan({ name: 'Muskelaufbau', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;

    const started = await startSessionFromTemplate(days[0].id);
    await finishSession(started.id);

    const repeated = await startSessionFromPreviousSession(started.id);
    expect(repeated.planId).toBe(plan.id);
    expect(repeated.planNameSnapshot).toBe('Muskelaufbau');
    expect(repeated.dayPositionSnapshot).toBe(days[0].position);
    expect(repeated.templateId).toBe(days[0].id);
  });

  it('keeps the historical name snapshot but drops the live link when the plan is gone', async () => {
    const plan = await createPlan({ name: 'Alter Plan', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    const started = await startSessionFromTemplate(days[0].id);
    await finishSession(started.id);

    await deletePlan(plan.id);

    const repeated = await startSessionFromPreviousSession(started.id);
    // No dangling live link to a deleted plan, but the history stays readable.
    expect(repeated.planId).toBeUndefined();
    expect(repeated.planNameSnapshot).toBe('Alter Plan');
    // And it must not smuggle in a stale active session.
    expect(repeated.status).toBe('active');
    expect(await db.workoutSessions.where('status').equals('active').count()).toBe(1);
  });
});

describe('session schedule snapshot (4.4)', () => {
  it('snapshots mode, planned date and the matching schedule entry', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    const { days } = (await getPlanWithDays(plan.id))!;
    await setScheduleMode(plan.id, 'repeating-cycle'); // seeds a workout entry per day

    const session = await startSessionFromTemplate(days[0].id);
    expect(session.scheduleModeSnapshot).toBe('repeating-cycle');
    expect(session.plannedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The snapshotted entry belongs to this plan and points at day 0.
    const entry = await db.scheduleEntries.get(session.scheduleEntryId!);
    expect(entry?.templateId).toBe(days[0].id);
  });

  it('leaves the schedule snapshot empty for a free workout', async () => {
    const free = await startFreeSession('Frei');
    expect(free.scheduleModeSnapshot).toBeUndefined();
    expect(free.plannedDate).toBeUndefined();
    expect(free.scheduleEntryId).toBeUndefined();
  });
});
