import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  getTemplateWithExercises,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import {
  activateTemplateVersion,
  createTemplateVersion,
  listTemplateVersions,
  snapshotTemplate,
} from '@/db/repositories/templateVersions';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: 'Test',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

async function buildTemplate() {
  const template = await createTemplate('Push', 'Oberkörper');
  const bench = await makeExerciseRow('Bankdrücken');
  const row = await makeExerciseRow('Rudern');
  const benchRow = await addExerciseToTemplate(template.id, bench);
  await addExerciseToTemplate(template.id, row);
  return { templateId: template.id, benchRowId: benchRow.id };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('snapshotTemplate', () => {
  it('captures the plan and exercise names', async () => {
    const { templateId } = await buildTemplate();
    const snapshot = await snapshotTemplate(templateId);
    expect(snapshot.name).toBe('Push');
    expect(snapshot.exercises).toHaveLength(2);
    expect(snapshot.exercises[0].exerciseNameSnapshot).toBe('Bankdrücken');
  });
});

describe('createTemplateVersion', () => {
  it('freezes the current plan and numbers versions', async () => {
    const { templateId } = await buildTemplate();
    const v1 = await createTemplateVersion(templateId, { label: 'Start' });
    const v2 = await createTemplateVersion(templateId, { source: 'ai-import' });

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
    const list = await listTemplateVersions(templateId);
    expect(list.map((version) => version.versionNumber)).toEqual([2, 1]); // newest first
  });

  it('is immutable: later edits do not change an existing version', async () => {
    const { templateId, benchRowId } = await buildTemplate();
    const version = await createTemplateVersion(templateId);
    await updateTemplateExercise(benchRowId, { targetSets: 5 });

    const stored = (await listTemplateVersions(templateId)).find(
      (v) => v.id === version.id,
    );
    expect(stored?.snapshot.exercises[0].targetSets).toBe(3); // frozen at 3
  });
});

describe('activateTemplateVersion', () => {
  it('restores an old version and preserves the replaced state as an auto version', async () => {
    const { templateId, benchRowId } = await buildTemplate();
    const original = await createTemplateVersion(templateId, { label: 'Original' });

    // Change the live plan.
    await updateTemplateExercise(benchRowId, { targetSets: 8 });
    expect((await getTemplateWithExercises(templateId))?.exercises[0].targetSets).toBe(8);

    // Reactivate the original.
    await activateTemplateVersion(original.id);
    const restored = await getTemplateWithExercises(templateId);
    expect(restored?.exercises[0].targetSets).toBe(3);

    // The state before restoring (8 sets) was auto-saved as its own version.
    const versions = await listTemplateVersions(templateId);
    const auto = versions.find((version) => version.source === 'auto');
    expect(auto?.snapshot.exercises[0].targetSets).toBe(8);
  });
});
