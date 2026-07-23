import { db } from '@/db/db';
import type {
  PlanSchedule,
  ScheduleEntry,
  ScheduleEntryType,
  ScheduleMode,
  WorkoutTemplate,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';
import {
  advanceCursor,
  cursorAfterCompletedWorkout,
  normalizeCursor,
  resolveScheduleState,
  type ScheduleState,
} from '@/services/schedule';

/**
 * Plan schedules and their entries.
 *
 * Each plan owns exactly one {@link PlanSchedule}. `free-rotation` needs no
 * stored entries — its order is derived from the plan's days at read time.
 * `repeating-cycle` and `weekly` store an ordered list of {@link ScheduleEntry}
 * rows (workout or rest days). This module owns creating, reading and editing
 * that schedule; the scheduling maths lives in the pure `services/schedule`.
 */

async function daysOfPlan(planId: string): Promise<WorkoutTemplate[]> {
  const days = await db.workoutTemplates.where('planId').equals(planId).toArray();
  return days.sort((a, b) => a.position - b.position);
}

// ---- creation & lookup ------------------------------------------------

/**
 * Creates a plan's schedule row. Called from `createPlan` inside its
 * transaction; free-rotation stores no entries.
 */
export async function createDefaultSchedule(planId: string): Promise<PlanSchedule> {
  const timestamp = nowIso();
  const schedule: PlanSchedule = {
    id: uuid(),
    planId,
    mode: 'free-rotation',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.planSchedules.add(schedule);
  return schedule;
}

/** Reads a plan's schedule, creating a default one if it is somehow missing. */
export async function ensureSchedule(planId: string): Promise<PlanSchedule> {
  const existing = await db.planSchedules.where('planId').equals(planId).first();
  if (existing) return existing;
  return createDefaultSchedule(planId);
}

/** Entries of a schedule, ordered by their stable position. */
export async function getEntries(scheduleId: string): Promise<ScheduleEntry[]> {
  const entries = await db.scheduleEntries
    .where('scheduleId')
    .equals(scheduleId)
    .toArray();
  return entries.sort((a, b) => a.position - b.position);
}

export interface PlanScheduleView {
  schedule: PlanSchedule;
  /** Stored entries (empty for free-rotation). */
  entries: ScheduleEntry[];
  /** The plan's workout units, ordered. */
  units: WorkoutTemplate[];
}

export async function getPlanScheduleView(planId: string): Promise<PlanScheduleView> {
  const [schedule, units] = await Promise.all([
    ensureSchedule(planId),
    daysOfPlan(planId),
  ]);
  const entries = await getEntries(schedule.id);
  return { schedule, entries, units };
}

/**
 * The last *completed* session's day for a plan, matched by plan snapshot or by
 * the day itself for older sessions. Drives the free-rotation suggestion.
 */
async function lastCompletedDay(
  planId: string,
  units: WorkoutTemplate[],
): Promise<{ templateId?: string; position?: number }> {
  const dayIds = new Set(units.map((day) => day.id));
  const completed = (
    await db.workoutSessions.where('status').equals('completed').toArray()
  )
    .filter(
      (session) =>
        session.planId === planId ||
        (session.templateId != null && dayIds.has(session.templateId)),
    )
    .sort((a, b) =>
      (b.finishedAt ?? b.startedAt).localeCompare(a.finishedAt ?? a.startedAt),
    );
  const last = completed[0];
  if (!last) return {};
  return { templateId: last.templateId, position: last.dayPositionSnapshot };
}

/**
 * Synthesises free-rotation entries from the plan's units so the pure resolver
 * can treat all three modes uniformly. For the stored modes the real entries
 * are used as-is.
 */
function entriesForResolve(view: PlanScheduleView): ScheduleEntry[] {
  if (view.schedule.mode !== 'free-rotation') return view.entries;
  return view.units.map((unit, index) => ({
    id: `unit-${unit.id}`,
    scheduleId: view.schedule.id,
    position: index,
    type: 'workout' as const,
    templateId: unit.id,
  }));
}

/** Resolves the current scheduling state for a plan (today, next, preview). */
export async function getPlanScheduleState(
  planId: string,
  today: Date = new Date(),
): Promise<ScheduleState> {
  const view = await getPlanScheduleView(planId);
  const last = await lastCompletedDay(planId, view.units);
  return resolveScheduleState({
    schedule: view.schedule,
    entries: entriesForResolve(view),
    units: view.units,
    lastCompletedTemplateId: last.templateId,
    lastCompletedPosition: last.position,
    today,
  });
}

// ---- mode ------------------------------------------------------------

/**
 * Switches a plan's schedule mode. Switching reseeds the entries to a sensible
 * default for the new mode, since the three modes model time differently:
 *   - free-rotation: no stored entries (order derived from the units).
 *   - repeating-cycle: one workout entry per unit, in unit order (add rest days
 *     afterwards).
 *   - weekly: no assignments yet (every weekday free) — the user pins units.
 * The cursor is reset. Callers confirm this reset in the UI.
 */
export async function setScheduleMode(planId: string, mode: ScheduleMode): Promise<void> {
  await db.transaction(
    'rw',
    db.planSchedules,
    db.scheduleEntries,
    db.workoutTemplates,
    async () => {
      const schedule = await ensureSchedule(planId);
      await db.scheduleEntries.where('scheduleId').equals(schedule.id).delete();

      if (mode === 'repeating-cycle') {
        const units = await daysOfPlan(planId);
        await db.scheduleEntries.bulkAdd(
          units.map((unit, index) => ({
            id: uuid(),
            scheduleId: schedule.id,
            position: index,
            type: 'workout' as const,
            templateId: unit.id,
          })),
        );
      }

      await db.planSchedules.update(schedule.id, {
        mode,
        cyclePosition: mode === 'repeating-cycle' ? 0 : undefined,
        updatedAt: nowIso(),
      });
    },
  );
}

// ---- cursor ----------------------------------------------------------

export async function setCyclePosition(planId: string, position: number): Promise<void> {
  const schedule = await ensureSchedule(planId);
  const count = await db.scheduleEntries.where('scheduleId').equals(schedule.id).count();
  await db.planSchedules.update(schedule.id, {
    cyclePosition: normalizeCursor(position, count),
    updatedAt: nowIso(),
  });
}

/** Advances the repeating-cycle cursor by one day (wraps). No-op otherwise. */
export async function advancePlanCursor(planId: string): Promise<void> {
  const schedule = await ensureSchedule(planId);
  if (schedule.mode !== 'repeating-cycle') return;
  const count = await db.scheduleEntries.where('scheduleId').equals(schedule.id).count();
  if (count === 0) return;
  await db.planSchedules.update(schedule.id, {
    cyclePosition: advanceCursor(schedule, count),
    updatedAt: nowIso(),
  });
}

/**
 * Advances a plan's schedule after a workout of that plan was completed. Only a
 * repeating cycle carries a mutable cursor; free-rotation derives its next day
 * from the completed sessions and weekly from the weekday, so both are no-ops
 * here. The cursor moves one past the matching cycle entry (see
 * {@link cursorAfterCompletedWorkout}) and stays put when the completed unit is
 * not in the cycle.
 *
 * Call this inside the session-completing transaction (its tables must include
 * `planSchedules` and `scheduleEntries`) so the completed session and the moved
 * cursor commit together, and only on the active→completed transition so a
 * repeated completion cannot advance twice.
 */
export async function advanceScheduleAfterWorkout(
  planId: string,
  completedTemplateId: string | undefined,
): Promise<void> {
  const schedule = await ensureSchedule(planId);
  if (schedule.mode !== 'repeating-cycle') return;
  const entries = await getEntries(schedule.id);
  const next = cursorAfterCompletedWorkout(schedule, entries, completedTemplateId);
  if (next === normalizeCursor(schedule.cyclePosition, entries.length)) return;
  await db.planSchedules.update(schedule.id, {
    cyclePosition: next,
    updatedAt: nowIso(),
  });
}

// ---- repeating-cycle entry editing -----------------------------------

async function nextPosition(scheduleId: string): Promise<number> {
  return db.scheduleEntries.where('scheduleId').equals(scheduleId).count();
}

/** Appends a workout day (or a rest day) to a repeating cycle. */
export async function addCycleEntry(
  planId: string,
  entry: { type: ScheduleEntryType; templateId?: string; label?: string },
): Promise<ScheduleEntry> {
  const schedule = await ensureSchedule(planId);
  const created: ScheduleEntry = {
    id: uuid(),
    scheduleId: schedule.id,
    position: await nextPosition(schedule.id),
    type: entry.type,
    templateId: entry.type === 'workout' ? entry.templateId : undefined,
    label: entry.label?.trim() || undefined,
  };
  await db.scheduleEntries.add(created);
  await db.planSchedules.update(schedule.id, { updatedAt: nowIso() });
  return created;
}

/** Changes what a cycle entry is (workout unit, rest, or label). */
export async function updateCycleEntry(
  entryId: string,
  changes: { type?: ScheduleEntryType; templateId?: string; label?: string },
): Promise<void> {
  const entry = await db.scheduleEntries.get(entryId);
  if (!entry) return;
  const type = changes.type ?? entry.type;
  await db.scheduleEntries.update(entryId, {
    type,
    templateId: type === 'workout' ? (changes.templateId ?? entry.templateId) : undefined,
    label: 'label' in changes ? changes.label?.trim() || undefined : entry.label,
  });
  await db.planSchedules.update(entry.scheduleId, { updatedAt: nowIso() });
}

async function renumberEntries(scheduleId: string): Promise<void> {
  const entries = await getEntries(scheduleId);
  await Promise.all(
    entries.map((entry, position) =>
      entry.position === position
        ? Promise.resolve(0)
        : db.scheduleEntries.update(entry.id, { position }),
    ),
  );
}

/** Removes a cycle entry and re-densifies the remaining order. */
export async function deleteCycleEntry(entryId: string): Promise<void> {
  await db.transaction('rw', db.planSchedules, db.scheduleEntries, async () => {
    const entry = await db.scheduleEntries.get(entryId);
    if (!entry) return;
    await db.scheduleEntries.delete(entryId);
    await renumberEntries(entry.scheduleId);
    const count = await db.scheduleEntries
      .where('scheduleId')
      .equals(entry.scheduleId)
      .count();
    const schedule = await db.planSchedules.get(entry.scheduleId);
    if (schedule?.cyclePosition != null) {
      await db.planSchedules.update(entry.scheduleId, {
        cyclePosition: normalizeCursor(schedule.cyclePosition, count),
        updatedAt: nowIso(),
      });
    } else {
      await db.planSchedules.update(entry.scheduleId, { updatedAt: nowIso() });
    }
  });
}

/** Moves a cycle entry one slot up or down. */
export async function moveCycleEntry(entryId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.planSchedules, db.scheduleEntries, async () => {
    const entry = await db.scheduleEntries.get(entryId);
    if (!entry) return;
    const entries = await getEntries(entry.scheduleId);
    const index = entries.findIndex((e) => e.id === entryId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    const reordered = [...entries];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await Promise.all(
      reordered.map((e, position) => db.scheduleEntries.update(e.id, { position })),
    );
    await db.planSchedules.update(entry.scheduleId, { updatedAt: nowIso() });
  });
}

/** Duplicates a cycle entry directly after itself. */
export async function duplicateCycleEntry(entryId: string): Promise<void> {
  await db.transaction('rw', db.planSchedules, db.scheduleEntries, async () => {
    const entry = await db.scheduleEntries.get(entryId);
    if (!entry) return;
    const entries = await getEntries(entry.scheduleId);
    const index = entries.findIndex((e) => e.id === entryId);
    const clone: ScheduleEntry = { ...entry, id: uuid(), position: index + 1 };
    // Shift everything after the source down by one, then insert the clone.
    await Promise.all(
      entries
        .slice(index + 1)
        .map((e, offset) =>
          db.scheduleEntries.update(e.id, { position: index + 2 + offset }),
        ),
    );
    await db.scheduleEntries.add(clone);
    await db.planSchedules.update(entry.scheduleId, { updatedAt: nowIso() });
  });
}

/** Clears every entry of a repeating cycle and resets the cursor. */
export async function resetCycle(planId: string): Promise<void> {
  await db.transaction('rw', db.planSchedules, db.scheduleEntries, async () => {
    const schedule = await ensureSchedule(planId);
    await db.scheduleEntries.where('scheduleId').equals(schedule.id).delete();
    await db.planSchedules.update(schedule.id, {
      cyclePosition: schedule.mode === 'repeating-cycle' ? 0 : undefined,
      updatedAt: nowIso(),
    });
  });
}

// ---- weekly assignment ------------------------------------------------

/**
 * Sets a weekday's assignment in a weekly plan: a workout unit, a rest day, or
 * cleared (removed). A weekday holds at most one entry.
 */
export async function setWeekdayAssignment(
  planId: string,
  weekday: number,
  assignment: { type: ScheduleEntryType; templateId?: string } | null,
): Promise<void> {
  await db.transaction('rw', db.planSchedules, db.scheduleEntries, async () => {
    const schedule = await ensureSchedule(planId);
    const existing = (await getEntries(schedule.id)).filter(
      (e) => (e.weekday ?? e.position) === weekday,
    );
    for (const entry of existing) await db.scheduleEntries.delete(entry.id);

    if (assignment) {
      await db.scheduleEntries.add({
        id: uuid(),
        scheduleId: schedule.id,
        position: weekday,
        weekday,
        type: assignment.type,
        templateId: assignment.type === 'workout' ? assignment.templateId : undefined,
      });
    }
    await db.planSchedules.update(schedule.id, { updatedAt: nowIso() });
  });
}

// ---- lifecycle hooks (called from the plans repository) ---------------

/**
 * Removes any schedule entries that reference a deleted unit, in whatever
 * schedule they live, and re-densifies the affected cycles. Free-rotation stores
 * no entries, so it needs no cleanup. Runs inside the caller's transaction.
 */
export async function removeUnitFromSchedules(templateId: string): Promise<void> {
  const affected = await db.scheduleEntries
    .where('templateId')
    .equals(templateId)
    .toArray();
  const scheduleIds = new Set(affected.map((entry) => entry.scheduleId));
  for (const entry of affected) await db.scheduleEntries.delete(entry.id);
  for (const scheduleId of scheduleIds) {
    const schedule = await db.planSchedules.get(scheduleId);
    // Weekly entries are keyed by weekday and must not be renumbered.
    if (schedule?.mode === 'repeating-cycle') await renumberEntries(scheduleId);
  }
}

/** Deletes a plan's schedule and all its entries. Runs inside a transaction. */
export async function deleteScheduleForPlan(planId: string): Promise<void> {
  const schedules = await db.planSchedules.where('planId').equals(planId).toArray();
  for (const schedule of schedules) {
    await db.scheduleEntries.where('scheduleId').equals(schedule.id).delete();
    await db.planSchedules.delete(schedule.id);
  }
}

/**
 * Copies a source plan's schedule onto a new plan, remapping unit references
 * through `dayIdMap` (old unit id → new unit id). Runs inside a transaction.
 */
export async function duplicateScheduleForPlan(
  sourcePlanId: string,
  targetPlanId: string,
  dayIdMap: Map<string, string>,
): Promise<void> {
  const source = await db.planSchedules.where('planId').equals(sourcePlanId).first();
  if (!source) return;
  const timestamp = nowIso();
  const newScheduleId = uuid();
  await db.planSchedules.add({
    ...source,
    id: newScheduleId,
    planId: targetPlanId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const entries = await getEntries(source.id);
  if (entries.length > 0) {
    await db.scheduleEntries.bulkAdd(
      entries.map((entry) => ({
        ...entry,
        id: uuid(),
        scheduleId: newScheduleId,
        templateId:
          entry.type === 'workout' && entry.templateId
            ? (dayIdMap.get(entry.templateId) ?? entry.templateId)
            : undefined,
      })),
    );
  }
}
