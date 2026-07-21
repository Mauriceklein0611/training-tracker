import { describe, expect, it } from 'vitest';
import {
  availableBodyMetrics,
  bodyRangeStartKey,
  buildBodyMetricSeries,
  movingAverage,
  readBodyMetric,
  trendWindow,
} from '@/services/bodyCharts';
import type { BodyWeightEntry } from '@/types';

function entry(date: string, values: Partial<BodyWeightEntry>): BodyWeightEntry {
  return {
    id: date,
    date,
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...values,
  };
}

describe('readBodyMetric', () => {
  it('reads weight, body fat and measurements', () => {
    const e = entry('2026-07-01', {
      weightKg: 80,
      bodyFatPercent: 17,
      measurements: { waistCm: 84 },
    });
    expect(readBodyMetric(e, 'weightKg')).toBe(80);
    expect(readBodyMetric(e, 'bodyFatPercent')).toBe(17);
    expect(readBodyMetric(e, 'waistCm')).toBe(84);
    expect(readBodyMetric(e, 'chestCm')).toBeUndefined();
  });
});

describe('availableBodyMetrics', () => {
  it('only offers metrics with at least two values', () => {
    const entries = [
      entry('2026-07-01', { weightKg: 80, bodyFatPercent: 17 }),
      entry('2026-07-08', { weightKg: 79 }),
    ];
    const keys = availableBodyMetrics(entries).map((option) => option.key);
    expect(keys).toContain('weightKg'); // two values
    expect(keys).not.toContain('bodyFatPercent'); // only one value
  });
});

describe('buildBodyMetricSeries', () => {
  it('drops entries without the metric and never emits zeros for gaps', () => {
    const entries = [
      entry('2026-07-01', { weightKg: 80 }),
      entry('2026-07-05', { bodyFatPercent: 17 }), // no weight
      entry('2026-07-10', { weightKg: 79 }),
    ];
    const series = buildBodyMetricSeries(entries, 'weightKg', 'all');
    expect(series.map((point) => point.value)).toEqual([80, 79]);
    expect(series.map((point) => point.date)).toEqual(['2026-07-01', '2026-07-10']);
  });

  it('sorts chronologically and clips to the range', () => {
    const now = new Date('2026-07-31T12:00:00');
    const entries = [
      entry('2026-07-10', { weightKg: 82 }),
      entry('2026-05-01', { weightKg: 85 }), // outside 4 weeks
      entry('2026-07-30', { weightKg: 80 }),
    ];
    const series = buildBodyMetricSeries(entries, 'weightKg', '4w', now);
    expect(series.map((point) => point.date)).toEqual(['2026-07-10', '2026-07-30']);
  });
});

describe('bodyRangeStartKey', () => {
  it('is null for "all" and a local day key otherwise', () => {
    const now = new Date('2026-07-31T12:00:00');
    expect(bodyRangeStartKey('all', now)).toBeNull();
    expect(bodyRangeStartKey('4w', now)).toBe('2026-07-04'); // 28 days inclusive
  });
});

describe('movingAverage', () => {
  it('computes a trailing average without a leading gap', () => {
    expect(movingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });

  it('returns the values unchanged for a window of one', () => {
    expect(movingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});

describe('trendWindow', () => {
  it('stays within sensible bounds', () => {
    expect(trendWindow(4)).toBe(3);
    expect(trendWindow(100)).toBe(7);
  });
});
