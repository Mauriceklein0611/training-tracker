import { db } from '@/db/db';
import type {
  Exercise,
  GroupRestMode,
  GroupType,
  TemplateExercise,
  TrainingPlan,
  WorkoutTemplate,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';
import {
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  planGroupNormalization,
} from '@/services/grouping';

export interface TemplateWithExercises {
  template: WorkoutTemplate;
  exercises: (TemplateExercise & { exercise?: Exercise })[];
}

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  const templates = await db.workoutTemplates.toArray();
  return templates.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function getTemplateWithExercises(
  templateId: string,
): Promise<TemplateWithExercises | undefined> {
  const template = await db.workoutTemplates.get(templateId);
  if (!template) return undefined;

  const rows = await db.templateExercises
    .where('templateId')
    .equals(templateId)
    .toArray();
  rows.sort((a, b) => a.order - b.order);

  const exercises = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      exercise: await db.exercises.get(row.exerciseId),
    })),
  );
  return { template, exercises };
}

/** Every plan with its exercises resolved — used by the AI export's plans block. */
export async function listTemplatesWithExercises(): Promise<TemplateWithExercises[]> {
  const templates = await listTemplates();
  return Promise.all(
    templates.map(
      async (template) =>
        (await getTemplateWithExercises(template.id)) as TemplateWithExercises,
    ),
  );
}

/**
 * Creates a plan that holds a single training day, and returns that day.
 *
 * This keeps the "one plan = one workout" flow intact: a plan always has at
 * least one day, so creating a plan means creating its first day too. Richer
 * multi-day creation lives in the plans repository (`createPlan`).
 */
export async function createTemplate(
  name: string,
  description = '',
): Promise<WorkoutTemplate> {
  return db.transaction('rw', db.trainingPlans, db.workoutTemplates, async () => {
    const timestamp = nowIso();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const plan: TrainingPlan = {
      id: uuid(),
      name: trimmedName,
      description: trimmedDescription,
      splitType: 'single',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.trainingPlans.add(plan);
    const template: WorkoutTemplate = {
      id: uuid(),
      planId: plan.id,
      name: trimmedName,
      description: trimmedDescription,
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutTemplates.add(template);
    return template;
  });
}

export async function updateTemplate(
  templateId: string,
  changes: Partial<Pick<WorkoutTemplate, 'name' | 'description'>>,
): Promise<void> {
  await db.workoutTemplates.update(templateId, { ...changes, updatedAt: nowIso() });
}

/** Deletes a template together with its exercise rows and versions. Sessions are untouched. */
export async function deleteTemplate(templateId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.templateVersions,
    async () => {
      await db.templateExercises.where('templateId').equals(templateId).delete();
      await db.templateVersions.where('templateId').equals(templateId).delete();
      await db.workoutTemplates.delete(templateId);
    },
  );
}

/** Duplicates a single training day within its plan, appended at the end. */
export async function duplicateTemplate(templateId: string): Promise<WorkoutTemplate> {
  return db.transaction('rw', db.workoutTemplates, db.templateExercises, async () => {
    const source = await db.workoutTemplates.get(templateId);
    if (!source) throw new Error('Der Trainingstag wurde nicht gefunden.');

    const position = await db.workoutTemplates
      .where('planId')
      .equals(source.planId)
      .count();
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

    const rows = await db.templateExercises
      .where('templateId')
      .equals(templateId)
      .toArray();
    await db.templateExercises.bulkAdd(
      rows.map((row) => ({ ...row, id: uuid(), templateId: copy.id })),
    );
    return copy;
  });
}

export async function addExerciseToTemplate(
  templateId: string,
  exercise: Exercise,
): Promise<TemplateExercise> {
  return db.transaction('rw', db.templateExercises, db.workoutTemplates, async () => {
    const existing = await db.templateExercises
      .where('templateId')
      .equals(templateId)
      .count();
    const row: TemplateExercise = {
      id: uuid(),
      templateId,
      exerciseId: exercise.id,
      order: existing,
      targetSets: 3,
      targetRepMin: exercise.trackingType === 'duration' ? undefined : 8,
      targetRepMax: exercise.trackingType === 'duration' ? undefined : 12,
      targetDurationSeconds: exercise.trackingType === 'duration' ? 60 : undefined,
      restSeconds: exercise.defaultRestSeconds,
      notes: '',
    };
    await db.templateExercises.add(row);
    await db.workoutTemplates.update(templateId, { updatedAt: nowIso() });
    return row;
  });
}

export async function updateTemplateExercise(
  id: string,
  changes: Partial<Omit<TemplateExercise, 'id' | 'templateId' | 'exerciseId'>>,
): Promise<void> {
  await db.templateExercises.update(id, changes);
}

export async function removeTemplateExercise(id: string): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const row = await db.templateExercises.get(id);
    if (!row) return;
    await db.templateExercises.delete(id);
    await renumberTemplateExercises(row.templateId);
    // Deleting a middle member can split a group or leave a single member.
    await persistTemplateGrouping(await orderedTemplateExercises(row.templateId));
  });
}

/**
 * Moves an entry one slot up or down.
 * This is the accessible counterpart to drag-and-drop and the only path that
 * actually writes the order, so both interactions stay consistent.
 */
export async function moveTemplateExercise(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const row = await db.templateExercises.get(id);
    if (!row) return;
    const siblings = await db.templateExercises
      .where('templateId')
      .equals(row.templateId)
      .toArray();
    siblings.sort((a, b) => a.order - b.order);

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
        db.templateExercises.update(entry.id, { order: position }),
      ),
    );
    reordered.forEach((entry, position) => {
      entry.order = position;
    });
    // Moving an exercise can pull it out of or into a group's run of members.
    await persistTemplateGrouping(reordered);
  });
}

/** Applies a completely new order, e.g. after a drag-and-drop drop. */
export async function reorderTemplateExercises(
  templateId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    await Promise.all(
      orderedIds.map((entryId, position) =>
        db.templateExercises.update(entryId, { order: position }),
      ),
    );
    await renumberTemplateExercises(templateId);
    await persistTemplateGrouping(await orderedTemplateExercises(templateId));
  });
}

/** Removes gaps in the order column so indexes stay 0..n-1. */
async function renumberTemplateExercises(templateId: string): Promise<void> {
  const rows = await db.templateExercises
    .where('templateId')
    .equals(templateId)
    .toArray();
  rows.sort((a, b) => a.order - b.order);
  await Promise.all(
    rows.map((row, position) =>
      row.order === position
        ? Promise.resolve(0)
        : db.templateExercises.update(row.id, { order: position }),
    ),
  );
}

async function orderedTemplateExercises(templateId: string): Promise<TemplateExercise[]> {
  const rows = await db.templateExercises
    .where('templateId')
    .equals(templateId)
    .toArray();
  return rows.sort((a, b) => a.order - b.order);
}

/** Writes the normalized grouping for a template's rows (in-memory intent). */
async function persistTemplateGrouping(rows: TemplateExercise[]): Promise<void> {
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

/**
 * Re-establishes the grouping invariants after a structural change: any group
 * left with a single member is dissolved, and split runs get distinct ids.
 */
export async function normalizeTemplateGroups(templateId: string): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    await persistTemplateGrouping(await orderedTemplateExercises(templateId));
  });
}

/**
 * Joins a template exercise into the group of the exercise directly above it,
 * creating a new superset if the exercise above is still standalone.
 */
export async function attachTemplateExerciseToPrevious(rowId: string): Promise<void> {
  await db.transaction('rw', db.templateExercises, db.workoutTemplates, async () => {
    const row = await db.templateExercises.get(rowId);
    if (!row) return;
    const rows = await orderedTemplateExercises(row.templateId);
    const index = rows.findIndex((entry) => entry.id === rowId);
    if (index <= 0) return;

    const prev = rows[index - 1];
    const groupId = prev.groupId ?? uuid();
    const groupType = prev.groupType ?? row.groupType ?? DEFAULT_GROUP_TYPE;
    const groupRestMode =
      prev.groupRestMode ?? row.groupRestMode ?? DEFAULT_GROUP_REST_MODE;

    Object.assign(prev, { groupId, groupType, groupRestMode });
    Object.assign(rows[index], { groupId, groupType, groupRestMode });

    await persistTemplateGrouping(rows);
    await db.workoutTemplates.update(row.templateId, { updatedAt: nowIso() });
  });
}

/** Removes a template exercise from its group, splitting the group if needed. */
export async function detachTemplateExercise(rowId: string): Promise<void> {
  await db.transaction('rw', db.templateExercises, db.workoutTemplates, async () => {
    const row = await db.templateExercises.get(rowId);
    if (!row?.groupId) return;
    const rows = await orderedTemplateExercises(row.templateId);
    const target = rows.find((entry) => entry.id === rowId);
    if (target) {
      target.groupId = undefined;
      target.groupType = undefined;
      target.groupRestMode = undefined;
    }
    await persistTemplateGrouping(rows);
    await db.workoutTemplates.update(row.templateId, { updatedAt: nowIso() });
  });
}

/** Updates the type or rest mode of every exercise in a template group. */
export async function setTemplateGroupOptions(
  templateId: string,
  groupId: string,
  changes: { groupType?: GroupType; groupRestMode?: GroupRestMode },
): Promise<void> {
  await db.transaction('rw', db.templateExercises, db.workoutTemplates, async () => {
    const rows = await db.templateExercises
      .where('templateId')
      .equals(templateId)
      .toArray();
    await Promise.all(
      rows
        .filter((row) => row.groupId === groupId)
        .map((row) => db.templateExercises.update(row.id, changes)),
    );
    await db.workoutTemplates.update(templateId, { updatedAt: nowIso() });
  });
}
