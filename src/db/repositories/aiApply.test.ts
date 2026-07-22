import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { listTemplateVersions } from '@/db/repositories/templateVersions';
import { commitAiAnalysis, importAiResponse } from '@/db/repositories/aiApply';
import { knownImportFingerprints, listAiAnalyses } from '@/db/repositories/aiAnalyses';
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

async function buildPlan() {
  const template = await createTemplate('Push', 'Alt');
  const exercise = await makeExerciseRow('Bankdrücken');
  const row = await addExerciseToTemplate(template.id, exercise);
  // Known starting targets.
  await updateTemplateExercise(row.id, {
    targetSets: 3,
    targetRepMin: 8,
    targetRepMax: 12,
    restSeconds: 120,
  });
  return { templateId: template.id, exerciseRowId: row.id };
}

function response(templateId: string, exerciseRowId: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 'training-ai-response',
    schemaVersion: 1,
    sourceExport: { exportId: 'exp', fingerprint: 'fp' },
    feedback: { summary: 'Solide Basis', recommendations: ['Pausen etwas verlängern'] },
    proposals: [
      {
        proposalId: 'p1',
        operation: 'update_template_exercise_target',
        target: { templateId, templateExerciseId: exerciseRowId },
        expected: { sets: 3, restSeconds: 120 },
        changes: { sets: 4, restSeconds: 150 },
        reason: 'Progression',
        ...overrides,
      },
    ],
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('importAiResponse', () => {
  it('validates against the live plan and returns pending proposals', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    const result = await importAiResponse(response(templateId, exerciseRowId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.proposals[0].status).toBe('pending');
    expect(result.value.proposals[0].exerciseName).toBe('Bankdrücken');
  });
});

describe('commitAiAnalysis', () => {
  it('applies a chosen proposal and freezes the plan as an ai-import version', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    const result = await importAiResponse(response(templateId, exerciseRowId));
    if (!result.ok) throw new Error('import failed');

    const analysis = await commitAiAnalysis(result.value, ['p1']);
    expect(analysis.proposals[0].status).toBe('applied');

    // The live plan was changed.
    const row = await db.templateExercises.get(exerciseRowId);
    expect(row?.targetSets).toBe(4);
    expect(row?.restSeconds).toBe(150);

    // A restore point was created capturing the pre-change state.
    const versions = await listTemplateVersions(templateId);
    const aiVersion = versions.find((version) => version.source === 'ai-import');
    expect(aiVersion?.snapshot.exercises[0].targetSets).toBe(3);

    // The analysis is stored.
    expect(await listAiAnalyses()).toHaveLength(1);
  });

  it('does not apply a proposal that was left unselected', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    const result = await importAiResponse(response(templateId, exerciseRowId));
    if (!result.ok) throw new Error('import failed');

    const analysis = await commitAiAnalysis(result.value, []); // nothing selected
    expect(analysis.proposals[0].status).toBe('skipped');
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
    // No ai-import version is created when nothing is applied.
    const versions = await listTemplateVersions(templateId);
    expect(versions.some((version) => version.source === 'ai-import')).toBe(false);
  });

  it('does not apply a stale (conflicting) proposal', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    // expected sets 5, but the plan has 3 → conflict.
    const result = await importAiResponse(
      response(templateId, exerciseRowId, { expected: { sets: 5 } }),
    );
    if (!result.ok) throw new Error('import failed');
    expect(result.value.proposals[0].status).toBe('conflict');

    const analysis = await commitAiAnalysis(result.value, ['p1']);
    expect(analysis.proposals[0].status).toBe('conflict');
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
  });

  it('records the import fingerprint so a duplicate can be detected', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    const result = await importAiResponse(response(templateId, exerciseRowId));
    if (!result.ok) throw new Error('import failed');
    await commitAiAnalysis(result.value, ['p1']);

    const seen = await knownImportFingerprints();
    expect(seen.has(result.value.importFingerprint)).toBe(true);
  });
});
