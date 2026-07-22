import { describe, expect, it } from 'vitest';
import { diffTemplateSnapshots } from '@/services/templateDiff';
import type { TemplateExerciseSnapshot, TemplateVersionSnapshot } from '@/types';

function ex(
  exerciseId: string,
  order: number,
  values: Partial<TemplateExerciseSnapshot> = {},
): TemplateExerciseSnapshot {
  return {
    exerciseId,
    exerciseNameSnapshot: exerciseId,
    order,
    targetSets: 3,
    targetRepMin: 8,
    targetRepMax: 12,
    restSeconds: 120,
    notes: '',
    ...values,
  };
}

function snap(
  name: string,
  exercises: TemplateExerciseSnapshot[],
  description = '',
): TemplateVersionSnapshot {
  return { name, description, exercises };
}

describe('diffTemplateSnapshots', () => {
  it('reports no changes for identical snapshots', () => {
    const a = snap('Plan', [ex('bench', 0), ex('row', 1)]);
    const diff = diffTemplateSnapshots(a, structuredClone(a));
    expect(diff.hasChanges).toBe(false);
    expect(diff.entries.every((entry) => entry.status === 'unchanged')).toBe(true);
  });

  it('detects field changes with before/after values', () => {
    const before = snap('Plan', [ex('bench', 0, { targetSets: 3, restSeconds: 120 })]);
    const after = snap('Plan', [ex('bench', 0, { targetSets: 4, restSeconds: 90 })]);
    const diff = diffTemplateSnapshots(before, after);

    expect(diff.hasChanges).toBe(true);
    const entry = diff.entries[0];
    expect(entry.status).toBe('changed');
    const sets = entry.changes.find((change) => change.label === 'Sätze');
    expect(sets).toEqual({ label: 'Sätze', before: '3', after: '4' });
    expect(entry.changes.find((change) => change.label === 'Pause (s)')?.after).toBe('90');
  });

  it('detects added and removed exercises', () => {
    const before = snap('Plan', [ex('bench', 0)]);
    const after = snap('Plan', [ex('bench', 0), ex('squat', 1)]);
    const diff = diffTemplateSnapshots(before, after);

    expect(diff.entries.find((entry) => entry.exerciseId === 'squat')?.status).toBe('added');

    const reversed = diffTemplateSnapshots(after, before);
    expect(reversed.entries.find((entry) => entry.exerciseId === 'squat')?.status).toBe('removed');
  });

  it('flags a pure reorder as moved', () => {
    const before = snap('Plan', [ex('bench', 0), ex('row', 1)]);
    const after = snap('Plan', [ex('row', 0), ex('bench', 1)]);
    const diff = diffTemplateSnapshots(before, after);
    expect(diff.entries.every((entry) => entry.status === 'moved')).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('detects a name change', () => {
    const diff = diffTemplateSnapshots(snap('Alt', [ex('bench', 0)]), snap('Neu', [ex('bench', 0)]));
    expect(diff.nameChange).toEqual({ before: 'Alt', after: 'Neu' });
    expect(diff.hasChanges).toBe(true);
  });

  it('describes grouping changes', () => {
    const before = snap('Plan', [ex('bench', 0), ex('row', 1)]);
    const after = snap('Plan', [
      ex('bench', 0, { groupId: 'g1', groupType: 'superset', groupRestMode: 'round' }),
      ex('row', 1, { groupId: 'g1', groupType: 'superset', groupRestMode: 'round' }),
    ]);
    const diff = diffTemplateSnapshots(before, after);
    const benchGroup = diff.entries
      .find((entry) => entry.exerciseId === 'bench')
      ?.changes.find((change) => change.label === 'Gruppe');
    expect(benchGroup?.before).toBe('keine');
    expect(benchGroup?.after).toContain('Supersatz');
  });
});
