import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  attachTemplateExerciseToPrevious,
  createTemplate,
  detachTemplateExercise,
  getTemplateWithExercises,
  removeTemplateExercise,
  setTemplateGroupOptions,
} from '@/db/repositories/templates';
import { getSessionDetail, startSessionFromTemplate } from '@/db/repositories/sessions';
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

async function buildTemplate(exerciseCount: number) {
  const template = await createTemplate('Plan');
  const rows = [];
  for (let i = 0; i < exerciseCount; i += 1) {
    const exercise = await makeExerciseRow(`Übung ${i + 1}`);
    rows.push(await addExerciseToTemplate(template.id, exercise));
  }
  return { templateId: template.id, rows };
}

async function orderedRows(templateId: string) {
  const data = await getTemplateWithExercises(templateId);
  return data?.exercises ?? [];
}

beforeEach(async () => {
  await resetDatabase();
});

describe('template grouping', () => {
  it('forms a superset when attaching to the previous exercise', async () => {
    const { templateId, rows } = await buildTemplate(2);
    await attachTemplateExerciseToPrevious(rows[1].id);

    const [a, b] = await orderedRows(templateId);
    expect(a.groupId).toBeTruthy();
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupType).toBe('superset');
    expect(a.groupRestMode).toBe('round');
  });

  it('extends the group to a third member and can switch to a circuit', async () => {
    const { templateId, rows } = await buildTemplate(3);
    await attachTemplateExerciseToPrevious(rows[1].id);
    await attachTemplateExerciseToPrevious(rows[2].id);

    const ordered = await orderedRows(templateId);
    const groupId = ordered[0].groupId;
    expect(ordered.every((row) => row.groupId === groupId)).toBe(true);

    await setTemplateGroupOptions(templateId, groupId as string, { groupType: 'circuit' });
    const updated = await orderedRows(templateId);
    expect(updated.every((row) => row.groupType === 'circuit')).toBe(true);
  });

  it('dissolves a two-member group when one is detached', async () => {
    const { templateId, rows } = await buildTemplate(2);
    await attachTemplateExerciseToPrevious(rows[1].id);
    await detachTemplateExercise(rows[1].id);

    const ordered = await orderedRows(templateId);
    expect(ordered.every((row) => row.groupId == null)).toBe(true);
  });

  it('keeps a contiguous group intact when a member is deleted', async () => {
    const { templateId, rows } = await buildTemplate(3);
    await attachTemplateExerciseToPrevious(rows[1].id);
    await attachTemplateExerciseToPrevious(rows[2].id);

    // Deleting a member of an A1–A3 group leaves the other two contiguous, so
    // they remain one group (a superset of two).
    await removeTemplateExercise(rows[1].id);
    const ordered = await orderedRows(templateId);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].groupId).toBeTruthy();
    expect(ordered[0].groupId).toBe(ordered[1].groupId);
  });

  it('splits into two groups with distinct ids when a middle member is detached', async () => {
    const { templateId, rows } = await buildTemplate(5);
    // Group all five: A1..A5.
    for (let i = 1; i < 5; i += 1) await attachTemplateExerciseToPrevious(rows[i].id);

    // Detach the middle exercise: [1,2] | 3 alone | [4,5].
    await detachTemplateExercise(rows[2].id);

    const ordered = await orderedRows(templateId);
    expect(ordered[2].groupId == null).toBe(true);
    expect(ordered[0].groupId).toBe(ordered[1].groupId);
    expect(ordered[3].groupId).toBe(ordered[4].groupId);
    // The two runs must not share an id, or a session would treat them as one.
    expect(ordered[0].groupId).not.toBe(ordered[3].groupId);
  });

  it('carries grouping into a session started from the template', async () => {
    const { templateId, rows } = await buildTemplate(2);
    await attachTemplateExerciseToPrevious(rows[1].id);

    const session = await startSessionFromTemplate(templateId);
    const detail = await getSessionDetail(session.id);
    expect(detail?.exercises[0].sessionExercise.groupId).toBeTruthy();
    expect(detail?.exercises[0].sessionExercise.groupId).toBe(
      detail?.exercises[1].sessionExercise.groupId,
    );
    expect(detail?.exercises[0].sessionExercise.groupType).toBe('superset');
  });
});
