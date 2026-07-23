import { db, ensureSettings } from '@/db/db';
import type { PlanUsagePeriod } from '@/types';
import { nowIso, uuid } from '@/utils/id';
import { dayKey } from '@/utils/date';

/**
 * The active plan and its usage periods (Phase 3).
 *
 * At most one plan is the active main plan, tracked by `settings.activePlanId`.
 * Each activation opens a {@link PlanUsagePeriod}; activating another plan closes
 * the previously open period (end = today) and opens a new one. Periods are kept
 * when a plan is deleted (the name snapshot keeps them readable) so the analysis
 * can attribute spans to a plan later. All dates are local calendar days.
 */

export async function getActivePlanId(): Promise<string | undefined> {
  return (await ensureSettings()).activePlanId;
}

/** The open (not yet ended) usage period of a plan, if any. */
export async function getOpenUsagePeriod(
  planId: string,
): Promise<PlanUsagePeriod | undefined> {
  const periods = await db.planUsagePeriods.where('planId').equals(planId).toArray();
  return periods.find((period) => !period.endDate);
}

export async function listUsagePeriods(planId?: string): Promise<PlanUsagePeriod[]> {
  const periods = planId
    ? await db.planUsagePeriods.where('planId').equals(planId).toArray()
    : await db.planUsagePeriods.toArray();
  return periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Makes a plan the active main plan. Idempotent: re-activating the current plan
 * does nothing. Otherwise the previously active plan's open period is closed
 * (end = today) and a fresh open period is started for the new plan.
 */
export async function activatePlan(
  planId: string,
  today: Date = new Date(),
): Promise<void> {
  const localDay = dayKey(today);
  await db.transaction(
    'rw',
    db.trainingPlans,
    db.planUsagePeriods,
    db.settings,
    async () => {
      const plan = await db.trainingPlans.get(planId);
      if (!plan) throw new Error('Der Trainingsplan wurde nicht gefunden.');

      const settings = await db.settings.get('app-settings');
      const currentActive = settings?.activePlanId;
      if (currentActive === planId) return; // already active — nothing to do

      await closeOpenPeriods(currentActive, localDay);

      const timestamp = nowIso();
      const period: PlanUsagePeriod = {
        id: uuid(),
        planId,
        planNameSnapshot: plan.name,
        startDate: localDay,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.planUsagePeriods.add(period);
      if (settings) {
        await db.settings.update('app-settings', {
          activePlanId: planId,
          updatedAt: timestamp,
        });
      }
    },
  );
}

/** Clears the active plan and closes its open usage period. */
export async function deactivatePlan(today: Date = new Date()): Promise<void> {
  const localDay = dayKey(today);
  await db.transaction('rw', db.planUsagePeriods, db.settings, async () => {
    const settings = await db.settings.get('app-settings');
    await closeOpenPeriods(settings?.activePlanId, localDay);
    if (settings?.activePlanId) {
      await db.settings.update('app-settings', {
        activePlanId: undefined,
        updatedAt: nowIso(),
      });
    }
  });
}

/** Ends any open period of a plan at the given local day. Internal helper. */
async function closeOpenPeriods(
  planId: string | undefined,
  localDay: string,
): Promise<void> {
  if (!planId) return;
  const open = await db.planUsagePeriods.where('planId').equals(planId).toArray();
  const timestamp = nowIso();
  for (const period of open) {
    if (period.endDate) continue;
    // A period started today and closed today collapses to a single day.
    await db.planUsagePeriods.update(period.id, {
      endDate: localDay < period.startDate ? period.startDate : localDay,
      updatedAt: timestamp,
    });
  }
}

/** Manual correction of a usage period's dates or note. */
export async function updateUsagePeriod(
  id: string,
  changes: Partial<Pick<PlanUsagePeriod, 'startDate' | 'endDate' | 'note'>>,
): Promise<void> {
  await db.planUsagePeriods.update(id, { ...changes, updatedAt: nowIso() });
}

export async function deleteUsagePeriod(id: string): Promise<void> {
  await db.planUsagePeriods.delete(id);
}
