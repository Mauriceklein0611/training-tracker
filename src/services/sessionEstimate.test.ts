import { describe, expect, it } from 'vitest';
import { estimateUnitMinutes } from '@/services/sessionEstimate';

describe('estimateUnitMinutes', () => {
  it('sums sets × (work + rest) across exercises', () => {
    // 3 × (40 + 80) = 360 s, plus 4 × (40 + 60) = 400 s → 760 s ≈ 13 min.
    expect(
      estimateUnitMinutes([
        { targetSets: 3, restSeconds: 80 },
        { targetSets: 4, restSeconds: 60 },
      ]),
    ).toBe(13);
  });

  it('uses the target duration for time-based sets', () => {
    // 3 × (120 + 60) = 540 s ≈ 9 min.
    expect(
      estimateUnitMinutes([
        { targetSets: 3, restSeconds: 60, targetDurationSeconds: 120 },
      ]),
    ).toBe(9);
  });

  it('falls back to nominal values when fields are missing', () => {
    // 3 × (40 + 90) = 390 s ≈ 7 min (rounded).
    expect(estimateUnitMinutes([{}])).toBe(7);
  });
});
