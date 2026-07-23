import type { Table } from 'dexie';
import type { PlanSchedule, TrainingPlan } from '@/types';
import { nowIso, uuid } from '@/utils/id';

/**
 * Ensures every plan owns a {@link PlanSchedule}.
 *
 * This is the schedule-system migration in one place, reused by:
 *   - the Dexie v18 upgrade (existing plans gain a schedule), and
 *   - backup restore (importing a backup written before the schedule system).
 *
 * A plan that already has a schedule is left untouched, so it is idempotent. A
 * fresh schedule is `free-rotation`, whose order is derived from the plan's days
 * (their stored `position`) at read time — so no entries are created and the
 * suggested rotation stays exactly as before. Rest days and the other two modes,
 * which do store entries, only ever come from an explicit user edit afterwards.
 */
export async function ensureSchedulesForPlans(
  plans: Table<TrainingPlan, string>,
  schedules: Table<PlanSchedule, string>,
  now: () => string = nowIso,
): Promise<number> {
  const scheduledPlanIds = new Set(
    (await schedules.toArray()).map((schedule) => schedule.planId),
  );
  const allPlans = await plans.toArray();
  let created = 0;

  for (const plan of allPlans) {
    if (scheduledPlanIds.has(plan.id)) continue;

    const timestamp = now();
    await schedules.add({
      id: uuid(),
      planId: plan.id,
      mode: 'free-rotation',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    scheduledPlanIds.add(plan.id);
    created += 1;
  }

  return created;
}
