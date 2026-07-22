import { subDays } from 'date-fns';
import type { BodyMeasurements, BodyWeightEntry } from '@/types';
import { dayKey } from '@/utils/date';
import { BODY_MEASUREMENT_FIELDS } from '@/utils/format';

/**
 * Body-data chart preparation.
 *
 * Pure functions over the body diary: they pick a single measurement series,
 * clip it to a timeframe using local calendar days, and optionally smooth it.
 * Days without a measurement are simply absent — never emitted as a zero — so a
 * gap in the diary never looks like a real drop to nothing.
 */

export type BodyMetricUnit = 'kg' | '%' | 'cm';
export type BodyMetricRange = '4w' | '12w' | '6m' | 'all';

export interface BodyMetricOption {
  key: string;
  label: string;
  unit: BodyMetricUnit;
}

const MEASUREMENT_KEYS = BODY_MEASUREMENT_FIELDS.map(
  (field) => field.key as keyof BodyMeasurements,
);

/** Every metric that can be charted, weight and body fat first. */
export const BODY_METRIC_OPTIONS: BodyMetricOption[] = [
  { key: 'weightKg', label: 'Körpergewicht', unit: 'kg' },
  { key: 'bodyFatPercent', label: 'Körperfettanteil', unit: '%' },
  ...BODY_MEASUREMENT_FIELDS.map((field) => ({
    key: field.key as string,
    label: field.label,
    unit: 'cm' as const,
  })),
];

export const BODY_RANGE_LABELS: Record<BodyMetricRange, string> = {
  '4w': '4 Wochen',
  '12w': '12 Wochen',
  '6m': '6 Monate',
  all: 'Alles',
};

const RANGE_DAYS: Record<Exclude<BodyMetricRange, 'all'>, number> = {
  '4w': 28,
  '12w': 84,
  '6m': 183,
};

/** Reads the numeric value of a metric from an entry, or undefined if unset. */
export function readBodyMetric(entry: BodyWeightEntry, key: string): number | undefined {
  if (key === 'weightKg') return entry.weightKg;
  if (key === 'bodyFatPercent') return entry.bodyFatPercent;
  if (MEASUREMENT_KEYS.includes(key as keyof BodyMeasurements)) {
    return entry.measurements?.[key as keyof BodyMeasurements];
  }
  return undefined;
}

/** Metrics that have at least two recorded values, i.e. enough to draw a line. */
export function availableBodyMetrics(entries: BodyWeightEntry[]): BodyMetricOption[] {
  return BODY_METRIC_OPTIONS.filter(
    (option) =>
      entries.filter((entry) => readBodyMetric(entry, option.key) != null).length >= 2,
  );
}

/** Inclusive earliest day key for a range, or null for "all". */
export function bodyRangeStartKey(
  range: BodyMetricRange,
  now: Date = new Date(),
): string | null {
  if (range === 'all') return null;
  return dayKey(subDays(now, RANGE_DAYS[range] - 1));
}

export interface BodyMetricPoint {
  date: string;
  value: number;
}

/**
 * Chronological points for one metric inside a range. Entries without a value
 * for that metric are dropped, so the series only ever contains real
 * measurements.
 */
export function buildBodyMetricSeries(
  entries: BodyWeightEntry[],
  key: string,
  range: BodyMetricRange,
  now: Date = new Date(),
): BodyMetricPoint[] {
  const startKey = bodyRangeStartKey(range, now);
  const points: BodyMetricPoint[] = [];
  for (const entry of entries) {
    if (startKey && entry.date < startKey) continue;
    const value = readBodyMetric(entry, key);
    if (value == null || !Number.isFinite(value)) continue;
    points.push({ date: entry.date, value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** A sensible moving-average window for a series of `count` points. */
export function trendWindow(count: number): number {
  return Math.min(7, Math.max(3, Math.round(count / 4)));
}

/**
 * Trailing simple moving average. The first `window-1` points average the fewer
 * values available so far, so the trend line has no leading gap; the result is
 * always the same length as the input.
 */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    const mean = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    result.push(Math.round(mean * 100) / 100);
  }
  return result;
}
