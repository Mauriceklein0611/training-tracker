import { db } from '@/db/db';
import type {
  Exercise,
  GroupRestMode,
  GroupType,
  TemplateExercise,
  WorkoutTemplate,
  WorkoutUnitTemplate,
  WorkoutUnitTemplateExercise,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';
import {
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  planGroupNormalization,
} from '@/services/grouping';

/**
 * The workout unit library (Phase 1).
 *
 * A {@link WorkoutUnitTemplate} ("Übungseinheit") is a reusable list of
 * exercises with targets that lives independently of any plan. Adding it to a
 * plan copies it into a plan-internal {@link WorkoutTemplate} (copy-on-add), so
 * later edits to the library unit never silently change existing plans. This
 * module mirrors the plan-day repository (`templates.ts`) field for field, so a
 * unit and a day carry the exact same shape and copy losslessly.
 */

export interface WorkoutUnitWithExercises {
  unit: WorkoutUnitTemplate;
  exercises: (WorkoutUnitTemplateExercise & { exercise?: Exercise })[];
}

// ---- reading ----------------------------------------------------------

export async function listWorkoutUnits(
  includeArchived = false,
): Promise<WorkoutUnitTemplate[]> {
  const units = await db.workoutUnitTemplates.toArray();
  return units
    .filter((unit) => includeArchived || !unit.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function getWorkoutUnitWithExercises(
  unitId: string,
): Promise<WorkoutUnitWithExercises | undefined> {
  const unit = await db.workoutUnitTemplates.get(unitId);
  if (!unit) return undefined;

  const rows = await db.workoutUnitTemplateExercises
    .where('unitTemplateId')
    .equals(unitId)
    .toArray();
  rows.sort((a, b) => a.order - b.order);

  const exercises = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      exercise: await db.exercises.get(row.exerciseId),
    })),
  );
  return { unit, exercises };
}

export async function listWorkoutUnitsWithExercises(
  includeArchived = false,
): Promise<WorkoutUnitWithExercises[]> {
  const units = await listWorkoutUnits(includeArchived);
  return Promise.all(
    units.map(
      async (unit) =>
        (await getWorkoutUnitWithExercises(unit.id)) as WorkoutUnitWithExercises,
    ),
  );
}

// ---- unit lifecycle ---------------------------------------------------

export async function createWorkoutUnit(input: {
  name: string;
  description?: string;
}): Promise<WorkoutUnitTemplate> {
  const timestamp = nowIso();
  const unit: WorkoutUnitTemplate = {
    id: uuid(),
    name: input.name.trim() || 'Neue Übungseinheit',
    description: (input.description ?? '').trim(),
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.workoutUnitTemplates.add(unit);
  return unit;
}

export async function updateWorkoutUnit(
  unitId: string,
  changes: Partial<Pick<WorkoutUnitTemplate, 'name' | 'description' | 'archived'>>,
): Promise<void> {
  await db.workoutUnitTemplates.update(unitId, { ...changes, updatedAt: nowIso() });
}

/**
 * Deletes a library unit and its exercises. Plans that copied it keep their
 * independent copies (copy-on-add), and no session is touched.
 */
export async function deleteWorkoutUnit(unitId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutUnitTemplates,
    db.workoutUnitTemplateExercises,
    async () => {
      await db.workoutUnitTemplateExercises
        .where('unitTemplateId')
        .equals(unitId)
        .delete();
      await db.workoutUnitTemplates.delete(unitId);
    },
  );
}

export async function duplicateWorkoutUnit(unitId: string): Promise<WorkoutUnitTemplate> {
  return db.transaction(
    'rw',
    db.workoutUnitTemplates,
    db.workoutUnitTemplateExercises,
    async () => {
      const source = await db.workoutUnitTemplates.get(unitId);
      if (!source) throw new Error('Die Übungseinheit wurde nicht gefunden.');
      const timestamp = nowIso();
      const copy: WorkoutUnitTemplate = {
        ...source,
        id: uuid(),
        name: `${source.name} (Kopie)`,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.workoutUnitTemplates.add(copy);

      const rows = await db.workoutUnitTemplateExercises
        .where('unitTemplateId')
        .equals(unitId)
        .toArray();
      await db.workoutUnitTemplateExercises.bulkAdd(
        rows.map((row) => ({ ...row, id: uuid(), unitTemplateId: copy.id })),
      );
      return copy;
    },
  );
}

// ---- exercises within a unit ------------------------------------------

export async function addExerciseToWorkoutUnit(
  unitId: string,
  exercise: Exercise,
): Promise<WorkoutUnitTemplateExercise> {
  return db.transaction(
    'rw',
    db.workoutUnitTemplateExercises,
    db.workoutUnitTemplates,
    async () => {
      const existing = await db.workoutUnitTemplateExercises
        .where('unitTemplateId')
        .equals(unitId)
        .count();
      const row: WorkoutUnitTemplateExercise = {
        id: uuid(),
        unitTemplateId: unitId,
        exerciseId: exercise.id,
        order: existing,
        targetSets: 3,
        targetRepMin: exercise.trackingType === 'duration' ? undefined : 8,
        targetRepMax: exercise.trackingType === 'duration' ? undefined : 12,
        targetDurationSeconds: exercise.trackingType === 'duration' ? 60 : undefined,
        restSeconds: exercise.defaultRestSeconds,
        notes: '',
      };
      await db.workoutUnitTemplateExercises.add(row);
      await db.workoutUnitTemplates.update(unitId, { updatedAt: nowIso() });
      return row;
    },
  );
}

export async function updateWorkoutUnitExercise(
  id: string,
  changes: Partial<
    Omit<WorkoutUnitTemplateExercise, 'id' | 'unitTemplateId' | 'exerciseId'>
  >,
): Promise<void> {
  await db.workoutUnitTemplateExercises.update(id, changes);
}

export async function removeWorkoutUnitExercise(id: string): Promise<void> {
  await db.transaction('rw', db.workoutUnitTemplateExercises, async () => {
    const row = await db.workoutUnitTemplateExercises.get(id);
    if (!row) return;
    await db.workoutUnitTemplateExercises.delete(id);
    await renumber(row.unitTemplateId);
    await persistGrouping(await ordered(row.unitTemplateId));
  });
}

export async function moveWorkoutUnitExercise(
  id: string,
  direction: -1 | 1,
): Promise<void> {
  await db.transaction('rw', db.workoutUnitTemplateExercises, async () => {
    const row = await db.workoutUnitTemplateExercises.get(id);
    if (!row) return;
    const siblings = await ordered(row.unitTemplateId);
    const index = siblings.findIndex((entry) => entry.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];
    await Promise.all(
      reordered.map((entry, position) =>
        db.workoutUnitTemplateExercises.update(entry.id, { order: position }),
      ),
    );
    reordered.forEach((entry, position) => {
      entry.order = position;
    });
    await persistGrouping(reordered);
  });
}

export async function reorderWorkoutUnitExercises(
  unitId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.workoutUnitTemplateExercises, async () => {
    await Promise.all(
      orderedIds.map((entryId, position) =>
        db.workoutUnitTemplateExercises.update(entryId, { order: position }),
      ),
    );
    await renumber(unitId);
    await persistGrouping(await ordered(unitId));
  });
}

async function renumber(unitId: string): Promise<void> {
  const rows = await ordered(unitId);
  await Promise.all(
    rows.map((row, position) =>
      row.order === position
        ? Promise.resolve(0)
        : db.workoutUnitTemplateExercises.update(row.id, { order: position }),
    ),
  );
}

async function ordered(unitId: string): Promise<WorkoutUnitTemplateExercise[]> {
  const rows = await db.workoutUnitTemplateExercises
    .where('unitTemplateId')
    .equals(unitId)
    .toArray();
  return rows.sort((a, b) => a.order - b.order);
}

async function persistGrouping(rows: WorkoutUnitTemplateExercise[]): Promise<void> {
  const plan = planGroupNormalization(rows, uuid);
  await Promise.all(
    rows.map((row) => {
      const fields = plan.get(row.id) ?? {};
      return db.workoutUnitTemplateExercises.put({
        ...row,
        groupId: fields.groupId,
        groupType: fields.groupType,
        groupRestMode: fields.groupRestMode,
      });
    }),
  );
}

export async function normalizeWorkoutUnitGroups(unitId: string): Promise<void> {
  await db.transaction('rw', db.workoutUnitTemplateExercises, async () => {
    await persistGrouping(await ordered(unitId));
  });
}

export async function attachWorkoutUnitExerciseToPrevious(rowId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutUnitTemplateExercises,
    db.workoutUnitTemplates,
    async () => {
      const row = await db.workoutUnitTemplateExercises.get(rowId);
      if (!row) return;
      const rows = await ordered(row.unitTemplateId);
      const index = rows.findIndex((entry) => entry.id === rowId);
      if (index <= 0) return;

      const prev = rows[index - 1];
      const groupId = prev.groupId ?? uuid();
      const groupType = prev.groupType ?? row.groupType ?? DEFAULT_GROUP_TYPE;
      const groupRestMode =
        prev.groupRestMode ?? row.groupRestMode ?? DEFAULT_GROUP_REST_MODE;

      Object.assign(prev, { groupId, groupType, groupRestMode });
      Object.assign(rows[index], { groupId, groupType, groupRestMode });

      await persistGrouping(rows);
      await db.workoutUnitTemplates.update(row.unitTemplateId, { updatedAt: nowIso() });
    },
  );
}

export async function detachWorkoutUnitExercise(rowId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutUnitTemplateExercises,
    db.workoutUnitTemplates,
    async () => {
      const row = await db.workoutUnitTemplateExercises.get(rowId);
      if (!row?.groupId) return;
      const rows = await ordered(row.unitTemplateId);
      const target = rows.find((entry) => entry.id === rowId);
      if (target) {
        target.groupId = undefined;
        target.groupType = undefined;
        target.groupRestMode = undefined;
      }
      await persistGrouping(rows);
      await db.workoutUnitTemplates.update(row.unitTemplateId, { updatedAt: nowIso() });
    },
  );
}

export async function setWorkoutUnitGroupOptions(
  unitId: string,
  groupId: string,
  changes: { groupType?: GroupType; groupRestMode?: GroupRestMode },
): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutUnitTemplateExercises,
    db.workoutUnitTemplates,
    async () => {
      const rows = await db.workoutUnitTemplateExercises
        .where('unitTemplateId')
        .equals(unitId)
        .toArray();
      await Promise.all(
        rows
          .filter((row) => row.groupId === groupId)
          .map((row) => db.workoutUnitTemplateExercises.update(row.id, changes)),
      );
      await db.workoutUnitTemplates.update(unitId, { updatedAt: nowIso() });
    },
  );
}

// ---- copy-on-add between library and plans ----------------------------

/**
 * Copies a library unit into a plan as a new, independent day, appended at the
 * end. The day records `sourceWorkoutUnitTemplateId` and a name snapshot for
 * provenance, but is a full copy: later edits to the library unit do not change
 * it. Returns the created day.
 */
export async function addWorkoutUnitToPlan(
  unitId: string,
  planId: string,
): Promise<WorkoutTemplate> {
  return db.transaction(
    'rw',
    db.workoutUnitTemplates,
    db.workoutUnitTemplateExercises,
    db.trainingPlans,
    db.workoutTemplates,
    db.templateExercises,
    async () => {
      const unit = await db.workoutUnitTemplates.get(unitId);
      if (!unit) throw new Error('Die Übungseinheit wurde nicht gefunden.');
      const plan = await db.trainingPlans.get(planId);
      if (!plan) throw new Error('Der Trainingsplan wurde nicht gefunden.');

      const position = await db.workoutTemplates.where('planId').equals(planId).count();
      const timestamp = nowIso();
      const day: WorkoutTemplate = {
        id: uuid(),
        planId,
        name: unit.name,
        description: unit.description,
        position,
        sourceWorkoutUnitTemplateId: unit.id,
        sourceWorkoutUnitNameSnapshot: unit.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.workoutTemplates.add(day);

      const rows = await db.workoutUnitTemplateExercises
        .where('unitTemplateId')
        .equals(unitId)
        .toArray();
      rows.sort((a, b) => a.order - b.order);
      const copied: TemplateExercise[] = rows.map((row, order) => ({
        id: uuid(),
        templateId: day.id,
        exerciseId: row.exerciseId,
        order,
        targetSets: row.targetSets,
        targetRepMin: row.targetRepMin,
        targetRepMax: row.targetRepMax,
        targetDurationSeconds: row.targetDurationSeconds,
        restSeconds: row.restSeconds,
        notes: row.notes,
        groupId: row.groupId,
        groupType: row.groupType,
        groupRestMode: row.groupRestMode,
      }));
      if (copied.length > 0) await db.templateExercises.bulkAdd(copied);
      await db.trainingPlans.update(planId, { updatedAt: timestamp });
      return day;
    },
  );
}

/**
 * Saves an existing plan day into the library as a new reusable unit (Phase
 * 1.3). A one-way copy: the new unit is independent and does not link back, so
 * editing the day later does not change the unit.
 */
export async function saveTemplateAsWorkoutUnit(
  templateId: string,
): Promise<WorkoutUnitTemplate> {
  return db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.workoutUnitTemplates,
    db.workoutUnitTemplateExercises,
    async () => {
      const day = await db.workoutTemplates.get(templateId);
      if (!day) throw new Error('Der Trainingstag wurde nicht gefunden.');
      const timestamp = nowIso();
      const unit: WorkoutUnitTemplate = {
        id: uuid(),
        name: day.name,
        description: day.description,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.workoutUnitTemplates.add(unit);

      const rows = await db.templateExercises
        .where('templateId')
        .equals(templateId)
        .toArray();
      rows.sort((a, b) => a.order - b.order);
      const copied: WorkoutUnitTemplateExercise[] = rows.map((row, order) => ({
        id: uuid(),
        unitTemplateId: unit.id,
        exerciseId: row.exerciseId,
        order,
        targetSets: row.targetSets,
        targetRepMin: row.targetRepMin,
        targetRepMax: row.targetRepMax,
        targetDurationSeconds: row.targetDurationSeconds,
        restSeconds: row.restSeconds,
        notes: row.notes,
        groupId: row.groupId,
        groupType: row.groupType,
        groupRestMode: row.groupRestMode,
      }));
      if (copied.length > 0) await db.workoutUnitTemplateExercises.bulkAdd(copied);
      return unit;
    },
  );
}
