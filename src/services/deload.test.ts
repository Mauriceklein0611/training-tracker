import { describe, expect, it } from 'vitest';
import {
  applyDeloadToSnapshot,
  DELOAD_DURATION_DAYS,
  deloadDuration,
  deloadEndDate,
  deloadRemainingDays,
  deloadSets,
  DELOAD_PERCENT,
  isDeloadActiveOn,
} from '@/services/deload';
import type { PlanDeloadPeriod, TemplateVersionSnapshot } from '@/types';

function period(overrides: Partial<PlanDeloadPeriod> = {}): PlanDeloadPeriod {
  return {
    id: 'd',
    planId: 'p',
    intensity: 'medium',
    startDate: '2026-07-10',
    endDate: deloadEndDate('2026-07-10'),
    setReductionPercent: 0.4,
    durationReductionPercent: 0.3,
    addedRir: 2,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
    ...overrides,
  };
}

describe('time-boxed deload window', () => {
  it('spans exactly seven local days including the start day', () => {
    expect(DELOAD_DURATION_DAYS).toBe(7);
    expect(deloadEndDate('2026-07-10')).toBe('2026-07-16');
  });

  it('is active from the start day through the end day, inclusive', () => {
    const p = period();
    expect(isDeloadActiveOn(p, new Date('2026-07-10T12:00:00'))).toBe(true);
    expect(isDeloadActiveOn(p, new Date('2026-07-16T12:00:00'))).toBe(true);
    expect(isDeloadActiveOn(p, new Date('2026-07-17T12:00:00'))).toBe(false);
    expect(isDeloadActiveOn(p, new Date('2026-07-09T12:00:00'))).toBe(false);
  });

  it('counts remaining days including today', () => {
    const p = period();
    expect(deloadRemainingDays(p, new Date('2026-07-10T12:00:00'))).toBe(7);
    expect(deloadRemainingDays(p, new Date('2026-07-16T12:00:00'))).toBe(1);
    expect(deloadRemainingDays(p, new Date('2026-07-17T12:00:00'))).toBe(0);
  });

  it('reduces a duration target and never below one second', () => {
    expect(deloadDuration(60, 0.3)).toBe(42);
    expect(deloadDuration(1, 0.9)).toBe(1);
  });
});

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
