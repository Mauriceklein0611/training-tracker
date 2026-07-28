import type { AnalyticsDataset } from '@/services/analytics';
import { computeAnalytics } from '@/services/analytics';
import { customRange, dayKey, daysInRange, type DateRange } from '@/utils/date';

/**
 * Local "training wrapped" — a period's highlights, compared with the equally
 * long period immediately before it.
 *
 * Purely a composition of {@link computeAnalytics}; it invents nothing. A delta
 * is only reported when the previous period actually had a value to compare
 * against, and "top muscles" simply lists what was trained most.
 */
export interface PeriodReview {
  sessions: number;
  activeMinutes: number;
  volumeKg: number;
  cardioMinutes: number;
  cardioDistanceMeters: number;
  /** Primary muscle groups with the most direct sets, most first (max three). */
  topMuscleGroups: string[];
  /** Percentage change vs the previous equal period, or null when not comparable. */
  sessionsDeltaPercent: number | null;
  volumeDeltaPercent: number | null;
}

/** The equally long period ending the day before `range` begins. */
export function previousPeriod(range: DateRange): DateRange {
  const days = daysInRange(range);
  const prevTo = new Date(range.from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return customRange(dayKey(prevFrom), dayKey(prevTo));
}

function percentDelta(previous: number, current: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildPeriodReview(
  dataset: AnalyticsDataset,
  range: DateRange,
  now: Date = new Date(),
): PeriodReview {
  const current = computeAnalytics(dataset, range, { now });
  const previous = computeAnalytics(dataset, previousPeriod(range), { now });

  const topMuscleGroups = [...current.muscleGroups]
    .filter((group) => group.directSets > 0)
    .sort((a, b) => b.directSets - a.directSets)
    .slice(0, 3)
    .map((group) => group.muscleGroup);

  return {
    sessions: current.sessionCount,
    activeMinutes: Math.round(current.totalDurationSeconds / 60),
    volumeKg: current.volume.volumeKg,
    cardioMinutes: Math.round(current.cardio.totalDurationSeconds / 60),
    cardioDistanceMeters: current.cardio.totalDistanceMeters,
    topMuscleGroups,
    sessionsDeltaPercent: percentDelta(previous.sessionCount, current.sessionCount),
    volumeDeltaPercent: percentDelta(previous.volume.volumeKg, current.volume.volumeKg),
  };
}
