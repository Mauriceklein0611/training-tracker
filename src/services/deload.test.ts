import { describe, expect, it } from 'vitest';
import { applyDeloadToSnapshot, deloadSets, DELOAD_PERCENT } from '@/services/deload';
import type { TemplateVersionSnapshot } from '@/types';

describe('deloadSets', () => {
  it('reduces sets by the given share and rounds', () => {
    expect(deloadSets(4, DELOAD_PERCENT.medium)).toBe(2); // 4 * 0.6 = 2.4 → 2
    expect(deloadSets(5, DELOAD_PERCENT.strong)).toBe(3); // 5 * 0.5 = 2.5 → 3
  });

  it('never drops below one set', () => {
    expect(deloadSets(1, DELOAD_PERCENT.strong)).toBe(1);
    expect(deloadSets(2, DELOAD_PERCENT.strong)).toBe(1);
  });
});

describe('applyDeloadToSnapshot', () => {
  it('reduces every exercise while leaving other fields intact', () => {
    const snapshot: TemplateVersionSnapshot = {
      name: 'Push',
      description: 'Oberkörper',
      exercises: [
        {
          exerciseId: 'bench',
          exerciseNameSnapshot: 'Bankdrücken',
          order: 0,
          targetSets: 4,
          targetRepMin: 8,
          targetRepMax: 12,
          restSeconds: 120,
          notes: '',
        },
      ],
    };
    const result = applyDeloadToSnapshot(snapshot, DELOAD_PERCENT.medium);
    expect(result.exercises[0].targetSets).toBe(2);
    expect(result.exercises[0].targetRepMin).toBe(8);
    expect(result.name).toBe('Push');
  });
});
