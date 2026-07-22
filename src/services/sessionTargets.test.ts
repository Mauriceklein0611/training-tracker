import { describe, expect, it } from 'vitest';
import { resolveEffectiveTarget } from '@/services/sessionTargets';
import { makeSessionExercise } from '@/tests/factories';

const planTarget = {
  targetSets: 3,
  targetRepMin: 8,
  targetRepMax: 12,
  targetDurationSeconds: 60,
  restSeconds: 120,
};

describe('resolveEffectiveTarget', () => {
  it('uses the frozen snapshots authoritatively for a v15 workout', () => {
    const se = makeSessionExercise({
      templateExerciseIdSnapshot: 'te-1',
      targetSetsSnapshot: 5,
      targetRepMinSnapshot: 3,
      targetRepMaxSnapshot: 5,
      restSecondsSnapshot: 150,
    });
    // Even with a different plan lookup, the per-position snapshot wins.
    const result = resolveEffectiveTarget(se, planTarget);
    expect(result?.targetSets).toBe(5);
    expect(result?.targetRepMin).toBe(3);
    expect(result?.targetRepMax).toBe(5);
    expect(result?.restSeconds).toBe(150);
  });

  it('merges rep and duration targets from the plan for a v14 active workout', () => {
    // Pre-v15: only targetSetsSnapshot exists, no templateExerciseIdSnapshot.
    const se = makeSessionExercise({ targetSetsSnapshot: 4, restSecondsSnapshot: 90 });
    const result = resolveEffectiveTarget(se, planTarget);
    expect(result?.targetSets).toBe(4); // from the snapshot
    expect(result?.targetRepMin).toBe(8); // fallback from the plan
    expect(result?.targetRepMax).toBe(12);
    expect(result?.targetDurationSeconds).toBe(60);
    expect(result?.restSeconds).toBe(90); // snapshot rest takes precedence
  });

  it('falls back entirely to the plan for a free workout with no snapshots', () => {
    const se = makeSessionExercise({ targetSetsSnapshot: undefined });
    expect(resolveEffectiveTarget(se, planTarget)).toEqual(planTarget);
    expect(resolveEffectiveTarget(se, undefined)).toBeUndefined();
  });
});
