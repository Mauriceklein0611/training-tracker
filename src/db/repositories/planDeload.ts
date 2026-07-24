import { db } from '@/db/db';
import type { DeloadIntensity, PlanDeloadPeriod } from '@/types';
import { nowIso, uuid } from '@/utils/id';
import { dayKey } from '@/utils/date';
import { DELOAD_DEFAULTS, deloadEndDate, isDeloadActiveOn } from '@/services/deload';

/**
 * Time-boxed plan deloads (Phase 5).
 *
 * A deload is a fixed 7-local-day window with snapshotted reductions. At most one
 * is active per plan; it ends automatically once its end day passes, and can be
 * ended early. The plan's stored target values are never touched — reductions are
 * only applied at session start (see `startSessionFromTemplate`).
 */

/** The plan's currently active deload for the given day, if any. */
export async function getActiveDeload(
  planId: string,
  today: Date = new Date(),
): Promise<PlanDeloadPeriod | undefined> {
  const periods = await db.planDeloadPeriods.where('planId').equals(planId).toArray();
  return periods.find((period) => isDeloadActiveOn(period, today));
}

export async function listDeloadPeriods(planId: string): Promise<PlanDeloadPeriod[]> {
  const periods = await db.planDeloadPeriods.where('planId').equals(planId).toArray();
  return periods.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * Starts a 7-day deload for a plan at the given intensity. Refuses to start a
 * second one while one is still active. Reductions are snapshotted from the
 * intensity defaults so later default changes never reinterpret this period.
 */
export async function startDeload(
  planId: string,
  intensity: DeloadIntensity,
  today: Date = new Date(),
): Promise<PlanDeloadPeriod> {
  return db.transaction('rw', db.planDeloadPeriods, async () => {
    const active = await getActiveDeload(planId, today);
    if (active) {
      throw new Error('Für diesen Plan läuft bereits ein Deload.');
    }
    const start = dayKey(today);
    const defaults = DELOAD_DEFAULTS[intensity];
    const timestamp = nowIso();
    const period: PlanDeloadPeriod = {
      id: uuid(),
      planId,
      intensity,
      startDate: start,
      endDate: deloadEndDate(start),
      setReductionPercent: defaults.setReductionPercent,
      durationReductionPercent: defaults.durationReductionPercent,
      addedRir: defaults.addedRir,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.planDeloadPeriods.add(period);
    return period;
  });
}

/**
 * Ends a plan's active deload early. The end day is pulled back to today, so the
 * remaining days are no longer deload; a session already started today keeps its
 * snapshot. No-op when nothing is active.
 */
export async function endDeloadEarly(
  planId: string,
  today: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', db.planDeloadPeriods, async () => {
    const active = await getActiveDeload(planId, today);
    if (!active) return;
    const key = dayKey(today);
    await db.planDeloadPeriods.update(active.id, {
      // Never before the start day, so the range stays valid.
      endDate: key < active.startDate ? active.startDate : key,
      endedEarlyAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}
