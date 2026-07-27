import { db } from '@/db/db';
import type {
  TemplateExercise,
  TemplateExerciseSnapshot,
  TemplateVersion,
  TemplateVersionSnapshot,
  TemplateVersionSource,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';

/**
 * Plan versioning.
 *
 * A version is an immutable snapshot of a plan (name, description and its
 * exercise rows) taken at one point in time. The live, editable plan stays in
 * the ordinary `workoutTemplates` / `templateExercises` tables; versions live
 * beside it and are never mutated after creation. This is the safety net the AI
 * import builds on: a change produces a new version instead of overwriting the
 * plan, and any earlier version can be reactivated.
 */

/** Reads the current live plan into an immutable snapshot. */
export async function snapshotTemplate(
  templateId: string,
): Promise<TemplateVersionSnapshot> {
  const template = await db.workoutTemplates.get(templateId);
  if (!template) throw new Error('Der Trainingsplan wurde nicht gefunden.');

  const rows = (
    await db.templateExercises.where('templateId').equals(templateId).toArray()
  ).sort((a, b) => a.order - b.order);
  const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))];
  const names = new Map(
    (await db.exercises.bulkGet(exerciseIds)).map((exercise, index) => [
      exerciseIds[index],
      exercise?.name,
    ]),
  );

  const exercises: TemplateExerciseSnapshot[] = rows.map((row) => ({
    exerciseId: row.exerciseId,
    exerciseNameSnapshot: names.get(row.exerciseId) ?? 'Gelöschte Übung',
    order: row.order,
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

  return { name: template.name, description: template.description, exercises };
}

async function nextVersionNumber(templateId: string): Promise<number> {
  const existing = await db.templateVersions
    .where('templateId')
    .equals(templateId)
    .toArray();
  return existing.reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1;
}

/**
 * Freezes the current live plan as a new version using the *ambient* Dexie
 * transaction — it opens none of its own, so it can be composed into a larger
 * atomic operation (e.g. the AI import). The caller's transaction must cover
 * workoutTemplates, templateExercises, exercises and templateVersions.
 */
export async function createTemplateVersionWithinTransaction(
  templateId: string,
  options: { label?: string; source?: TemplateVersionSource; note?: string } = {},
): Promise<TemplateVersion> {
  const snapshot = await snapshotTemplate(templateId);
  const version: TemplateVersion = {
    id: uuid(),
    templateId,
    versionNumber: await nextVersionNumber(templateId),
    label: options.label?.trim() || snapshot.name,
    source: options.source ?? 'manual',
    note: options.note?.trim() || undefined,
    snapshot,
    createdAt: nowIso(),
  };
  await db.templateVersions.add(version);
  return version;
}

/** Freezes the current live plan as a new version. */
export async function createTemplateVersion(
  templateId: string,
  options: { label?: string; source?: TemplateVersionSource; note?: string } = {},
): Promise<TemplateVersion> {
  return db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.exercises,
    db.templateVersions,
    () => createTemplateVersionWithinTransaction(templateId, options),
  );
}

export async function listTemplateVersions(
  templateId: string,
): Promise<TemplateVersion[]> {
  const versions = await db.templateVersions
    .where('templateId')
    .equals(templateId)
    .toArray();
  return versions.sort((a, b) => b.versionNumber - a.versionNumber);
}

export async function getTemplateVersion(
  id: string,
): Promise<TemplateVersion | undefined> {
  return db.templateVersions.get(id);
}

/** Turns a snapshot back into live template exercise rows. */
function rowsFromSnapshot(
  templateId: string,
  snapshot: TemplateVersionSnapshot,
): TemplateExercise[] {
  return snapshot.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((exercise, index) => ({
      id: uuid(),
      templateId,
      exerciseId: exercise.exerciseId,
      order: index,
      targetSets: exercise.targetSets,
      targetRepMin: exercise.targetRepMin,
      targetRepMax: exercise.targetRepMax,
      targetDurationSeconds: exercise.targetDurationSeconds,
      restSeconds: exercise.restSeconds,
      notes: exercise.notes,
      groupId: exercise.groupId,
      groupType: exercise.groupType,
      groupRestMode: exercise.groupRestMode,
    }));
}

/**
 * Makes a saved version the live plan again, using the *ambient* Dexie
 * transaction (opens none of its own), so it can be composed into a larger
 * atomic operation such as the AI-import undo. The caller's transaction must
 * cover workoutTemplates, templateExercises, exercises and templateVersions.
 *
 * The current live state is first frozen as its own ("auto") version, so
 * reactivating an older version never loses the plan that was active before —
 * the operation is fully reversible by reactivating that auto version.
 */
export async function activateTemplateVersionWithinTransaction(
  versionId: string,
): Promise<void> {
  const version = await db.templateVersions.get(versionId);
  if (!version) throw new Error('Die Planversion wurde nicht gefunden.');
  const template = await db.workoutTemplates.get(version.templateId);
  if (!template) throw new Error('Der Trainingsplan wurde nicht gefunden.');

  // Preserve the state we are about to replace.
  const currentSnapshot = await snapshotTemplate(version.templateId);
  await db.templateVersions.add({
    id: uuid(),
    templateId: version.templateId,
    versionNumber: await nextVersionNumber(version.templateId),
    label: `Automatisch gesichert vor Wiederherstellung von v${version.versionNumber}`,
    source: 'auto',
    snapshot: currentSnapshot,
    createdAt: nowIso(),
  });

  // Replace the live plan's exercises with the version's snapshot.
  await db.templateExercises.where('templateId').equals(version.templateId).delete();
  await db.templateExercises.bulkAdd(
    rowsFromSnapshot(version.templateId, version.snapshot),
  );
  await db.workoutTemplates.update(version.templateId, {
    name: version.snapshot.name,
    description: version.snapshot.description,
    updatedAt: nowIso(),
  });
}

/** Makes a saved version the live plan again in its own transaction. */
export async function activateTemplateVersion(versionId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.exercises,
    db.templateVersions,
    () => activateTemplateVersionWithinTransaction(versionId),
  );
}

export async function setTemplateVersionArchived(
  versionId: string,
  archived: boolean,
): Promise<void> {
  await db.templateVersions.update(versionId, { archived });
}

export async function deleteTemplateVersion(versionId: string): Promise<void> {
  await db.templateVersions.delete(versionId);
}

/** Removes every version of a template — used when the plan itself is deleted. */
export async function deleteVersionsForTemplate(templateId: string): Promise<void> {
  await db.templateVersions.where('templateId').equals(templateId).delete();
}
