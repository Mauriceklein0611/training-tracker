import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import {
  bodyValueTrend,
  hasAnyBodyValue,
  listBodyWeightEntries,
  upsertBodyWeightEntry,
} from '@/db/repositories/bodyWeight';
import { resetDatabase } from '@/tests/dbTestUtils';

beforeEach(async () => {
  await resetDatabase();
});

describe('body data entries', () => {
  it('stores weight, body fat and measurements together', async () => {
    await upsertBodyWeightEntry({
      date: '2026-07-20',
      weightKg: 80.5,
      bodyFatPercent: 17.5,
      measurements: { waistCm: 84, chestCm: 102, bicepsLeftCm: 38 },
      notes: 'morgens',
    });

    const [entry] = await listBodyWeightEntries();
    expect(entry.weightKg).toBe(80.5);
    expect(entry.bodyFatPercent).toBe(17.5);
    expect(entry.measurements?.waistCm).toBe(84);
    expect(entry.measurements?.bicepsLeftCm).toBe(38);
  });

  it('accepts an entry that only carries measurements', async () => {
    await upsertBodyWeightEntry({ date: '2026-07-20', measurements: { waistCm: 84 } });

    const [entry] = await listBodyWeightEntries();
    expect(entry.weightKg).toBeUndefined();
    expect(entry.measurements?.waistCm).toBe(84);
  });

  it('drops empty measurements instead of storing undefined fields', async () => {
    await upsertBodyWeightEntry({
      date: '2026-07-20',
      weightKg: 80,
      measurements: { waistCm: undefined, chestCm: undefined },
    });

    const [entry] = await listBodyWeightEntries();
    expect(entry.measurements).toBeUndefined();
  });

  it('merges a later entry into the same day without losing earlier values', async () => {
    // Weighed in the morning …
    await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });
    // … measured in the evening.
    await upsertBodyWeightEntry({ date: '2026-07-20', measurements: { waistCm: 84 } });

    const entries = await listBodyWeightEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].weightKg).toBe(80);
    expect(entries[0].measurements?.waistCm).toBe(84);
  });

  it('overwrites only the values that were entered again', async () => {
    await upsertBodyWeightEntry({
      date: '2026-07-20',
      weightKg: 80,
      measurements: { waistCm: 84, chestCm: 102 },
    });
    await upsertBodyWeightEntry({ date: '2026-07-20', measurements: { waistCm: 83 } });

    const [entry] = await listBodyWeightEntries();
    expect(entry.weightKg).toBe(80);
    expect(entry.measurements?.waistCm).toBe(83);
    expect(entry.measurements?.chestCm).toBe(102);
  });

  it('keeps one entry per day and sorts newest first', async () => {
    await upsertBodyWeightEntry({ date: '2026-07-18', weightKg: 81 });
    await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });

    const entries = await listBodyWeightEntries();
    expect(entries.map((entry) => entry.date)).toEqual(['2026-07-20', '2026-07-18']);
    expect(await db.bodyWeightEntries.count()).toBe(2);
  });
});

describe('hasAnyBodyValue', () => {
  it('rejects a completely empty entry', () => {
    expect(hasAnyBodyValue({ date: '2026-07-20' })).toBe(false);
    expect(hasAnyBodyValue({ date: '2026-07-20', measurements: {} })).toBe(false);
  });

  it('accepts an entry with any single value', () => {
    expect(hasAnyBodyValue({ date: '2026-07-20', weightKg: 80 })).toBe(true);
    expect(hasAnyBodyValue({ date: '2026-07-20', bodyFatPercent: 17 })).toBe(true);
    expect(hasAnyBodyValue({ date: '2026-07-20', measurements: { neckCm: 39 } })).toBe(true);
  });
});

describe('bodyValueTrend', () => {
  it('computes the change between the first and the latest recorded value', async () => {
    await upsertBodyWeightEntry({ date: '2026-07-01', weightKg: 84 });
    await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });

    const trend = bodyValueTrend(await listBodyWeightEntries(), (entry) => entry.weightKg);
    expect(trend.latest).toBe(80);
    expect(trend.first).toBe(84);
    expect(trend.change).toBe(-4);
  });

  it('ignores days on which the field was not measured', async () => {
    await upsertBodyWeightEntry({ date: '2026-07-01', measurements: { waistCm: 88 } });
    await upsertBodyWeightEntry({ date: '2026-07-10', weightKg: 82 });
    await upsertBodyWeightEntry({ date: '2026-07-20', measurements: { waistCm: 85 } });

    const trend = bodyValueTrend(
      await listBodyWeightEntries(),
      (entry) => entry.measurements?.waistCm,
    );
    expect(trend.latest).toBe(85);
    expect(trend.change).toBe(-3);
  });

  it('reports no change when only one value exists', async () => {
    await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });

    const trend = bodyValueTrend(await listBodyWeightEntries(), (entry) => entry.weightKg);
    expect(trend.latest).toBe(80);
    expect(trend.change).toBeNull();
  });

  it('handles a field that was never recorded', () => {
    const trend = bodyValueTrend([], (entry) => entry.weightKg);
    expect(trend.latest).toBeNull();
    expect(trend.change).toBeNull();
  });
});
