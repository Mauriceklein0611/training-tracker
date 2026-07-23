import type { Table } from 'dexie';
import type { TrainingPlan, WorkoutTemplate } from '@/types';
import { nowIso, uuid } from '@/utils/id';

/**
 * Wraps every "orphan" training day (a {@link WorkoutTemplate} without a valid
 * owning plan) into its own single-day {@link TrainingPlan}.
 *
 * This is the split-system migration in one place, reused by:
 *   - the Dexie v17 upgrade (converting existing plans), and
 *   - backup restore (importing a backup written before the split system).
 *
 * It is idempotent: a day that already points at an existing plan is left
 * untouched, so running it again never creates duplicate plans. Dates are
 * carried over from the day so nothing shifts in time unnecessarily.
 */
export async function wrapOrphanTemplatesInPlans(
  plans: Table<TrainingPlan, string>,
  templates: Table<WorkoutTemplate, string>,
  now: () => string = nowIso,
): Promise<number> {
  const planIds = new Set((await plans.toArray()).map((plan) => plan.id));
  const days = await templates.toArray();
  let wrapped = 0;

  for (const day of days) {
    if (day.planId && planIds.has(day.planId)) continue; // already owned by a plan

    const plan: TrainingPlan = {
      id: uuid(),
      name: day.name,
      description: day.description ?? '',
      splitType: 'single',
      createdAt: day.createdAt || now(),
      updatedAt: day.updatedAt || now(),
    };
    await plans.add(plan);
    planIds.add(plan.id);
    await templates.update(day.id, { planId: plan.id, position: 0 });
    wrapped += 1;
  }

  return wrapped;
}
