import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { listTemplateVersions } from '@/db/repositories/templateVersions';
import {
  buildPlanContext,
  commitAiAnalysis,
  importAiResponse,
} from '@/db/repositories/aiApply';
import {
  knownImportFingerprints,
  listAiAnalyses,
  recordAiExport,
} from '@/db/repositories/aiAnalyses';
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

/** Builds a plan and records a matching export, so provenance is valid. */
async function prepareWithExport() {
  const plan = await buildPlan();
  const context = await buildPlanContext();
  await recordAiExport('exp', context.currentFingerprint);
  return { ...plan, fingerprint: context.currentFingerprint };
}

function response(
  templateId: string,
  exerciseRowId: string,
  fingerprint: string,
  overrides: Record<string, unknown> = {},
) {
  return JSON.stringify({
    format: 'training-ai-response',
    schemaVersion: 1,
    sourceExport: { exportId: 'exp', fingerprint },
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
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provenance).toBe('valid');
    expect(result.value.proposals[0].status).toBe('pending');
    expect(result.value.proposals[0].exerciseName).toBe('Bankdrücken');
  });

  it('locks proposals but keeps feedback when the export is unknown', async () => {
    const { templateId, exerciseRowId } = await buildPlan(); // no export recorded
    const result = await importAiResponse(
      response(templateId, exerciseRowId, 'unknown-fp'),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.proposalsApplicable).toBe(false);
    expect(result.value.proposals[0].status).toBe('invalid');
    expect(result.value.feedback.summary).toBe('Solide Basis');
  });
});

describe('commitAiAnalysis', () => {
  it('applies a chosen proposal and freezes the plan as an ai-import version', async () => {
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint),
    );
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
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint),
    );
    if (!result.ok) throw new Error('import failed');

    const analysis = await commitAiAnalysis(result.value, []); // nothing selected
    expect(analysis.proposals[0].status).toBe('skipped');
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
    // No ai-import version is created when nothing is applied.
    const versions = await listTemplateVersions(templateId);
    expect(versions.some((version) => version.source === 'ai-import')).toBe(false);
  });

  it('does not apply a stale (conflicting) proposal', async () => {
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    // expected sets 5, but the plan has 3 → conflict (expected still covers changes).
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint, {
        expected: { sets: 5, restSeconds: 120 },
      }),
    );
    if (!result.ok) throw new Error('import failed');
    expect(result.value.proposals[0].status).toBe('conflict');

    const analysis = await commitAiAnalysis(result.value, ['p1']);
    expect(analysis.proposals[0].status).toBe('conflict');
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
  });

  it('never applies changes from an unknown-export response', async () => {
    const { templateId, exerciseRowId } = await buildPlan();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, 'unknown-fp'),
    );
    if (!result.ok) throw new Error('import failed');

    const analysis = await commitAiAnalysis(result.value, ['p1']);
    // Feedback is saved, but nothing is applied and no version is created.
    expect(analysis.proposals[0].status).toBe('invalid');
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
    expect(
      (await listTemplateVersions(templateId)).some((v) => v.source === 'ai-import'),
    ).toBe(false);
    expect(await listAiAnalyses()).toHaveLength(1);
  });

  it('rolls the whole transaction back when saving fails', async () => {
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint),
    );
    if (!result.ok) throw new Error('import failed');

    await expect(
      commitAiAnalysis(result.value, ['p1'], new Date(), {
        beforeSave: () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow();

    // Nothing survived: no plan change, no restore version, no saved analysis.
    expect((await db.templateExercises.get(exerciseRowId))?.targetSets).toBe(3);
    expect(
      (await listTemplateVersions(templateId)).some((v) => v.source === 'ai-import'),
    ).toBe(false);
    expect(await listAiAnalyses()).toHaveLength(0);
  });

  it('records the import fingerprint so a duplicate can be detected', async () => {
    const { templateId, exerciseRowId, fingerprint } = await prepareWithExport();
    const result = await importAiResponse(
      response(templateId, exerciseRowId, fingerprint),
    );
    if (!result.ok) throw new Error('import failed');
    await commitAiAnalysis(result.value, ['p1']);

    const seen = await knownImportFingerprints();
    expect(seen.has(result.value.importFingerprint)).toBe(true);
  });
});
