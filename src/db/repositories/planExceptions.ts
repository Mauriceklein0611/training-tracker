import { db } from '@/db/db';
import type { PlanScheduleException, PlanScheduleExceptionType } from '@/types';
import { nowIso, uuid } from '@/utils/id';

/**
 * Per-day plan schedule exceptions (Phase 4).
 *
 * At most one exception exists per plan+date. Setting one for a day that already
 * has an exception updates it in place, so the calendar never accumulates
 * conflicting overrides for the same day. The schedule itself is never touched —
 * an exception only re-colours a single calendar day.
 */

async function exceptionsOfPlan(planId: string): Promise<PlanScheduleException[]> {
  return db.planScheduleExceptions.where('planId').equals(planId).toArray();
}

/** All exceptions of a plan, ordered by date. */
export async function listPlanExceptions(
  planId: string,
): Promise<PlanScheduleException[]> {
  const rows = await exceptionsOfPlan(planId);
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Creates or updates the exception for a plan+date. Idempotent per day. */
export async function setPlanException(
  planId: string,
  date: string,
  type: PlanScheduleExceptionType,
  note?: string,
): Promise<PlanScheduleException> {
  return db.transaction('rw', db.planScheduleExceptions, async () => {
    const existing = (await exceptionsOfPlan(planId)).find((row) => row.date === date);
    const now = nowIso();
    const trimmedNote = note?.trim() || undefined;
    if (existing) {
      const updated: PlanScheduleException = {
        ...existing,
        type,
        note: trimmedNote,
        updatedAt: now,
      };
      await db.planScheduleExceptions.put(updated);
      return updated;
    }
    const created: PlanScheduleException = {
      id: uuid(),
      planId,
      date,
      type,
      note: trimmedNote,
      createdAt: now,
      updatedAt: now,
    };
    await db.planScheduleExceptions.add(created);
    return created;
  });
}

/** Removes the exception for a plan+date if one exists. */
export async function clearPlanException(planId: string, date: string): Promise<void> {
  await db.transaction('rw', db.planScheduleExceptions, async () => {
    const matching = (await exceptionsOfPlan(planId)).filter((row) => row.date === date);
    await Promise.all(matching.map((row) => db.planScheduleExceptions.delete(row.id)));
  });
}
