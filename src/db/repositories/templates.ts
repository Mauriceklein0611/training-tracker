import { db } from '@/db/db';
import type { Exercise, TemplateExercise, WorkoutTemplate } from '@/types';
import { nowIso, uuid } from '@/utils/id';

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

  const rows = await db.templateExercises.where('templateId').equals(templateId).toArray();
  rows.sort((a, b) => a.order - b.order);

  const exercises = await Promise.all(
    rows.map(async (row) => ({ ...row, exercise: await db.exercises.get(row.exerciseId) })),
  );
  return { template, exercises };
}

export async function createTemplate(name: string, description = ''): Promise<WorkoutTemplate> {
  const timestamp = nowIso();
  const template: WorkoutTemplate = {
    id: uuid(),
    name,
    description,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.workoutTemplates.add(template);
  return template;
}

export async function updateTemplate(
  templateId: string,
  changes: Partial<Pick<WorkoutTemplate, 'name' | 'description'>>,
): Promise<void> {
  await db.workoutTemplates.update(templateId, { ...changes, updatedAt: nowIso() });
}

/** Deletes a template together with its exercise rows. Sessions are untouched. */
export async function deleteTemplate(templateId: string): Promise<void> {
  await db.transaction('rw', db.workoutTemplates, db.templateExercises, async () => {
    await db.templateExercises.where('templateId').equals(templateId).delete();
    await db.workoutTemplates.delete(templateId);
  });
}

export async function duplicateTemplate(templateId: string): Promise<WorkoutTemplate> {
  return db.transaction('rw', db.workoutTemplates, db.templateExercises, async () => {
    const source = await db.workoutTemplates.get(templateId);
    if (!source) throw new Error('Der Trainingsplan wurde nicht gefunden.');

    const timestamp = nowIso();
    const copy: WorkoutTemplate = {
      ...source,
      id: uuid(),
      name: `${source.name} (Kopie)`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutTemplates.add(copy);

    const rows = await db.templateExercises.where('templateId').equals(templateId).toArray();
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
    const existing = await db.templateExercises.where('templateId').equals(templateId).count();
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
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await Promise.all(
      reordered.map((entry, position) => db.templateExercises.update(entry.id, { order: position })),
    );
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
  });
}

/** Removes gaps in the order column so indexes stay 0..n-1. */
async function renumberTemplateExercises(templateId: string): Promise<void> {
  const rows = await db.templateExercises.where('templateId').equals(templateId).toArray();
  rows.sort((a, b) => a.order - b.order);
  await Promise.all(
    rows.map((row, position) =>
      row.order === position
        ? Promise.resolve(0)
        : db.templateExercises.update(row.id, { order: position }),
    ),
  );
}
