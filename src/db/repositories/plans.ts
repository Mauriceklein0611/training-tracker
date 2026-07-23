import { db } from '@/db/db';
import type {
  DeloadIntensity,
  PlanSplitType,
  TemplateExercise,
  TrainingPlan,
  WorkoutTemplate,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';
import { planGroupNormalization } from '@/services/grouping';

/**
 * Training plans and their training days.
 *
 * A plan is the parent of one or more days. A day is a {@link WorkoutTemplate}
 * (the unit a workout is started from). This module owns everything that spans
 * days — creating a plan from a split, rotation, moving exercises between days —
 * while the per-day exercise editing stays in the templates repository.
 */

export interface PlanWithDays {
  plan: TrainingPlan;
  /** Days ordered by their stable position. */
  days: WorkoutTemplate[];
}

/** Days a split type starts with; "single"/"custom" simply begin with one. */
export const SPLIT_TYPE_DAY_COUNT: Record<PlanSplitType, number> = {
  single: 1,
  '2-day': 2,
  '3-day': 3,
  '4-day': 4,
  '5-day': 5,
  custom: 1,
};

export const SPLIT_TYPE_LABELS: Record<PlanSplitType, string> = {
  single: 'Einzeltraining',
  '2-day': '2er-Split',
  '3-day': '3er-Split',
  '4-day': '4er-Split',
  '5-day': '5er-Split',
  custom: 'Benutzerdefiniert',
};

/** Named structure templates that only seed day names, never exercises (§3). */
export interface PlanStructureTemplate {
  id: string;
  label: string;
  dayNames: string[];
  splitType: PlanSplitType;
}

export const PLAN_STRUCTURE_TEMPLATES: PlanStructureTemplate[] = [
  { id: 'single', label: 'Einzeltraining', dayNames: ['Training'], splitType: 'single' },
  {
    id: 'fullbody-ab',
    label: 'Ganzkörper A/B',
    dayNames: ['Ganzkörper A', 'Ganzkörper B'],
    splitType: '2-day',
  },
  {
    id: 'upper-lower',
    label: 'Oberkörper/Unterkörper',
    dayNames: ['Oberkörper', 'Unterkörper'],
    splitType: '2-day',
  },
  { id: 'push-pull', label: 'Push/Pull', dayNames: ['Push', 'Pull'], splitType: '2-day' },
  {
    id: 'ppl',
    label: 'Push/Pull/Beine',
    dayNames: ['Push', 'Pull', 'Beine'],
    splitType: '3-day',
  },
  {
    id: 'upper-lower-ab',
    label: 'Oberkörper/Unterkörper A/B',
    dayNames: ['Oberkörper A', 'Unterkörper A', 'Oberkörper B', 'Unterkörper B'],
    splitType: '4-day',
  },
  {
    id: 'ppl-ul',
    label: 'Push/Pull/Beine/Oberkörper/Unterkörper',
    dayNames: ['Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper'],
    splitType: '5-day',
  },
];

/** "Tag A", "Tag B", … then "Tag 27" once the alphabet runs out. */
export function defaultDayName(position: number): string {
  return position < 26
    ? `Tag ${String.fromCharCode(65 + position)}`
    : `Tag ${position + 1}`;
}

export async function listPlans(): Promise<TrainingPlan[]> {
  const plans = await db.trainingPlans.toArray();
  return plans.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

async function daysOfPlan(planId: string): Promise<WorkoutTemplate[]> {
  const days = await db.workoutTemplates.where('planId').equals(planId).toArray();
  return days.sort((a, b) => a.position - b.position);
}

export async function getPlanWithDays(planId: string): Promise<PlanWithDays | undefined> {
  const plan = await db.trainingPlans.get(planId);
  if (!plan) return undefined;
  return { plan, days: await daysOfPlan(planId) };
}

/** Every plan with its days resolved, for the plan overview. */
export async function listPlansWithDays(): Promise<PlanWithDays[]> {
  const plans = await listPlans();
  return Promise.all(
    plans.map(async (plan) => ({ plan, days: await daysOfPlan(plan.id) })),
  );
}

function makeDay(
  planId: string,
  name: string,
  position: number,
  timestamp: string,
): WorkoutTemplate {
  return {
    id: uuid(),
    planId,
    name,
    description: '',
    position,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Creates a plan and its initial days. Days come from `dayNames` when given
 * (a structure template), otherwise one per the split type's day count. A plan
 * always has at least one day.
 */
export async function createPlan(input: {
  name: string;
  description?: string;
  splitType: PlanSplitType;
  dayNames?: string[];
}): Promise<TrainingPlan> {
  const name = input.name.trim();
  if (!name) throw new Error('Der Planname darf nicht leer sein.');

  const count = Math.max(
    1,
    input.dayNames?.length ?? SPLIT_TYPE_DAY_COUNT[input.splitType],
  );
  const names = Array.from(
    { length: count },
    (_, index) =>
      (input.dayNames?.[index] ?? defaultDayName(index)).trim() || defaultDayName(index),
  );

  return db.transaction('rw', db.trainingPlans, db.workoutTemplates, async () => {
    const timestamp = nowIso();
    const plan: TrainingPlan = {
      id: uuid(),
      name,
      description: input.description?.trim() ?? '',
      splitType: input.splitType,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.trainingPlans.add(plan);
    await db.workoutTemplates.bulkAdd(
      names.map((dayName, index) => makeDay(plan.id, dayName, index, timestamp)),
    );
    return plan;
  });
}

export async function updatePlan(
  planId: string,
  changes: Partial<Pick<TrainingPlan, 'name' | 'description' | 'splitType'>>,
): Promise<void> {
  const patch = { ...changes };
  if (patch.name != null) patch.name = patch.name.trim();
  await db.trainingPlans.update(planId, { ...patch, updatedAt: nowIso() });
}

/** Sets or clears the plan-level deload (non-destructive; applied only at start). */
export async function setPlanDeload(
  planId: string,
  intensity: DeloadIntensity | undefined,
): Promise<void> {
  await db.trainingPlans.update(planId, {
    deloadIntensity: intensity,
    updatedAt: nowIso(),
  });
}

/**
 * Deletes a plan with all its days, their exercise rows and versions. Sessions
 * are untouched — completed and running workouts keep their own snapshots.
 */
export async function deletePlan(planId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.trainingPlans,
    db.workoutTemplates,
    db.templateExercises,
    db.templateVersions,
    async () => {
      const days = await db.workoutTemplates.where('planId').equals(planId).toArray();
      for (const day of days) {
        await db.templateExercises.where('templateId').equals(day.id).delete();
        await db.templateVersions.where('templateId').equals(day.id).delete();
      }
      await db.workoutTemplates.where('planId').equals(planId).delete();
      await db.trainingPlans.delete(planId);
    },
  );
}

/** Duplicates a whole plan: all days, their order, names and exercise rows. */
export async function duplicatePlan(planId: string): Promise<TrainingPlan> {
  return db.transaction(
    'rw',
    db.trainingPlans,
    db.workoutTemplates,
    db.templateExercises,
    async () => {
      const source = await db.trainingPlans.get(planId);
      if (!source) throw new Error('Der Trainingsplan wurde nicht gefunden.');
      const days = await daysOfPlan(planId);

      const timestamp = nowIso();
      const copy: TrainingPlan = {
        ...source,
        id: uuid(),
        name: `${source.name} (Kopie)`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.trainingPlans.add(copy);

      for (const day of days) {
        const newDayId = uuid();
        await db.workoutTemplates.add({
          ...day,
          id: newDayId,
          planId: copy.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        const rows = await db.templateExercises
          .where('templateId')
          .equals(day.id)
          .toArray();
        await db.templateExercises.bulkAdd(
          rows.map((row) => ({ ...row, id: uuid(), templateId: newDayId })),
        );
      }
      return copy;
    },
  );
}

// ---- rotation ---------------------------------------------------------

/**
 * The training day to suggest next for a plan, derived from the last *completed*
 * workout of this plan and the current day order.
 *
 * - No completed workout yet → the first day.
 * - Otherwise the day after the last completed one, wrapping around to the first.
 * - Active or discarded workouts never advance the rotation (only completed
 *   sessions are considered), so an aborted or running session leaves it be.
 * - If the last trained day was since deleted, the day now at its former
 *   position is used, so a changed order or a removed day still resolves.
 *
 * Older sessions without plan snapshots are matched by their day (templateId).
 */
export async function nextDayForPlan(
  planId: string,
): Promise<WorkoutTemplate | undefined> {
  const days = await daysOfPlan(planId);
  if (days.length === 0) return undefined;
  const dayIds = new Set(days.map((day) => day.id));

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
  if (!last) return days[0];

  const lastIndex = days.findIndex((day) => day.id === last.templateId);
  if (lastIndex < 0) {
    // The trained day was deleted; resume at whatever now holds its position.
    const position = Math.min(last.dayPositionSnapshot ?? 0, days.length - 1);
    return days[Math.max(0, position)];
  }
  return days[(lastIndex + 1) % days.length];
}

// ---- day management ---------------------------------------------------

export async function addDay(
  planId: string,
  name?: string,
  description = '',
): Promise<WorkoutTemplate> {
  return db.transaction('rw', db.trainingPlans, db.workoutTemplates, async () => {
    const existing = await daysOfPlan(planId);
    const position = existing.length;
    const timestamp = nowIso();
    const day = makeDay(
      planId,
      name?.trim() || defaultDayName(position),
      position,
      timestamp,
    );
    day.description = description.trim();
    await db.workoutTemplates.add(day);
    await db.trainingPlans.update(planId, { updatedAt: timestamp });
    return day;
  });
}

export class LastDayError extends Error {
  constructor() {
    super('Ein Plan muss mindestens einen Trainingstag behalten.');
    this.name = 'LastDayError';
  }
}

/** Deletes a day, refusing to remove the plan's last one so no plan is left empty. */
export async function deleteDay(dayId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.trainingPlans,
    db.workoutTemplates,
    db.templateExercises,
    db.templateVersions,
    async () => {
      const day = await db.workoutTemplates.get(dayId);
      if (!day) return;
      const siblings = await daysOfPlan(day.planId);
      if (siblings.length <= 1) throw new LastDayError();

      await db.templateExercises.where('templateId').equals(dayId).delete();
      await db.templateVersions.where('templateId').equals(dayId).delete();
      await db.workoutTemplates.delete(dayId);
      await renumberDays(day.planId);
      await db.trainingPlans.update(day.planId, { updatedAt: nowIso() });
    },
  );
}

/** Duplicates a single day within its plan, appended at the end. */
export async function duplicateDay(dayId: string): Promise<WorkoutTemplate> {
  return db.transaction(
    'rw',
    db.trainingPlans,
    db.workoutTemplates,
    db.templateExercises,
    async () => {
      const source = await db.workoutTemplates.get(dayId);
      if (!source) throw new Error('Der Trainingstag wurde nicht gefunden.');
      const position = (await daysOfPlan(source.planId)).length;
      const timestamp = nowIso();
      const copy: WorkoutTemplate = {
        ...source,
        id: uuid(),
        name: `${source.name} (Kopie)`,
        position,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.workoutTemplates.add(copy);
      const rows = await db.templateExercises.where('templateId').equals(dayId).toArray();
      await db.templateExercises.bulkAdd(
        rows.map((row) => ({ ...row, id: uuid(), templateId: copy.id })),
      );
      await db.trainingPlans.update(source.planId, { updatedAt: timestamp });
      return copy;
    },
  );
}

/** Moves a day one slot up or down within its plan. */
export async function moveDay(dayId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.trainingPlans, db.workoutTemplates, async () => {
    const day = await db.workoutTemplates.get(dayId);
    if (!day) return;
    const days = await daysOfPlan(day.planId);
    const index = days.findIndex((entry) => entry.id === dayId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= days.length) return;

    const reordered = [...days];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await Promise.all(
      reordered.map((entry, position) =>
        db.workoutTemplates.update(entry.id, { position }),
      ),
    );
    await db.trainingPlans.update(day.planId, { updatedAt: nowIso() });
  });
}

async function renumberDays(planId: string): Promise<void> {
  const days = await daysOfPlan(planId);
  await Promise.all(
    days.map((day, position) =>
      day.position === position
        ? Promise.resolve(0)
        : db.workoutTemplates.update(day.id, { position }),
    ),
  );
}

// ---- moving exercises between days ------------------------------------

async function normalizeDayGroups(dayId: string): Promise<void> {
  const rows = (
    await db.templateExercises.where('templateId').equals(dayId).toArray()
  ).sort((a, b) => a.order - b.order);
  const plan = planGroupNormalization(rows, uuid);
  await Promise.all(
    rows.map((row) => {
      const fields = plan.get(row.id) ?? {};
      return db.templateExercises.put({
        ...row,
        groupId: fields.groupId,
        groupType: fields.groupType,
        groupRestMode: fields.groupRestMode,
      });
    }),
  );
}

async function appendRowToDay(row: TemplateExercise, targetDayId: string): Promise<void> {
  const count = await db.templateExercises
    .where('templateId')
    .equals(targetDayId)
    .count();
  await db.templateExercises.put({ ...row, templateId: targetDayId, order: count });
}

/** Moves an exercise row to another day, appended at that day's end. */
export async function moveExerciseToDay(
  templateExerciseId: string,
  targetDayId: string,
): Promise<void> {
  await db.transaction('rw', db.workoutTemplates, db.templateExercises, async () => {
    const row = await db.templateExercises.get(templateExerciseId);
    if (!row || row.templateId === targetDayId) return;
    const sourceDayId = row.templateId;
    await appendRowToDay(row, targetDayId);
    // Re-densify the source day's order and repair both days' grouping.
    const remaining = (
      await db.templateExercises.where('templateId').equals(sourceDayId).toArray()
    )
      .filter((entry) => entry.id !== templateExerciseId)
      .sort((a, b) => a.order - b.order);
    await Promise.all(
      remaining.map((entry, index) =>
        db.templateExercises.update(entry.id, { order: index }),
      ),
    );
    await normalizeDayGroups(sourceDayId);
    await normalizeDayGroups(targetDayId);
    const now = nowIso();
    await db.workoutTemplates.update(sourceDayId, { updatedAt: now });
    await db.workoutTemplates.update(targetDayId, { updatedAt: now });
  });
}

/** Copies an exercise row to another day, appended at that day's end. */
export async function copyExerciseToDay(
  templateExerciseId: string,
  targetDayId: string,
): Promise<void> {
  await db.transaction('rw', db.workoutTemplates, db.templateExercises, async () => {
    const row = await db.templateExercises.get(templateExerciseId);
    if (!row) return;
    const count = await db.templateExercises
      .where('templateId')
      .equals(targetDayId)
      .count();
    await db.templateExercises.add({
      ...row,
      id: uuid(),
      templateId: targetDayId,
      order: count,
      // A copied row starts ungrouped in its new day; grouping is per-day.
      groupId: undefined,
      groupType: undefined,
      groupRestMode: undefined,
    });
    await db.workoutTemplates.update(targetDayId, { updatedAt: nowIso() });
  });
}
