import type { AnalyticsDataset } from '@/services/analytics';
import { computeAnalytics } from '@/services/analytics';
import { customRange, dayKey, type DateRange } from '@/utils/date';

/**
 * Local, deterministic coach insights.
 *
 * Every insight is computed from the user's own data with a transparent rule and
 * a stated basis and timeframe — there is no model, no "fitness score" and no
 * diagnosis. When there is not enough data for a rule, that rule produces
 * nothing rather than an invented statement. Callers show at most a few.
 */

export type CoachTone = 'positive' | 'neutral' | 'attention';

export interface CoachInsight {
  id: string;
  /** The insight itself, in plain language. */
  text: string;
  /** "Warum wird das angezeigt?" — the calculation basis and the timeframe. */
  why: string;
  tone: CoachTone;
}

/** A range spanning the days `[fromDaysAgo, toDaysAgo]` before `now` (inclusive). */
function rangeDaysAgo(now: Date, fromDaysAgo: number, toDaysAgo: number): DateRange {
  const at = (offset: number) => dayKey(new Date(now.getTime() - offset * 86400000));
  return customRange(at(fromDaysAgo), at(toDaysAgo));
}

const roundPercent = (previous: number, current: number): number =>
  Math.round(((current - previous) / previous) * 100);

/** Training frequency this week vs the mean of the previous four weeks. */
function frequencyInsight(dataset: AnalyticsDataset, now: Date): CoachInsight | null {
  const thisWeek = computeAnalytics(dataset, rangeDaysAgo(now, 6, 0), {
    now,
  }).sessionCount;
  const prior = computeAnalytics(dataset, rangeDaysAgo(now, 34, 7), { now }).sessionCount;
  // Need a prior baseline to compare against, and some activity to talk about.
  if (prior < 2 && thisWeek === 0) return null;
  const priorPerWeek = prior / 4;
  if (priorPerWeek === 0) return null;

  if (thisWeek >= priorPerWeek) {
    return {
      id: 'frequency-up',
      text: `Du bist diese Woche gut dabei: ${thisWeek} ${
        thisWeek === 1 ? 'Einheit' : 'Einheiten'
      }.`,
      why: `Einheiten der letzten 7 Tage (${thisWeek}) gegenüber dem Schnitt der 4 Wochen davor (${priorPerWeek.toFixed(
        1,
      )} pro Woche).`,
      tone: 'positive',
    };
  }
  return {
    id: 'frequency-down',
    text: `Diese Woche waren es ${thisWeek} ${
      thisWeek === 1 ? 'Einheit' : 'Einheiten'
    } — etwas weniger als zuletzt.`,
    why: `Einheiten der letzten 7 Tage (${thisWeek}) gegenüber dem Schnitt der 4 Wochen davor (${priorPerWeek.toFixed(
      1,
    )} pro Woche).`,
    tone: 'attention',
  };
}

/** Strength volume of the last 7 days vs the 7 days before that. */
function volumeTrendInsight(dataset: AnalyticsDataset, now: Date): CoachInsight | null {
  const current = computeAnalytics(dataset, rangeDaysAgo(now, 6, 0), { now }).volume
    .volumeKg;
  const previous = computeAnalytics(dataset, rangeDaysAgo(now, 13, 7), { now }).volume
    .volumeKg;
  if (!(current > 0) || !(previous > 0)) return null;
  const percent = roundPercent(previous, current);
  if (Math.abs(percent) < 5) return null; // ignore noise

  return {
    id: 'volume-trend',
    text:
      percent > 0
        ? `Dein Kraftvolumen ist gegenüber der Vorwoche um ${percent} % gestiegen.`
        : `Dein Kraftvolumen liegt ${Math.abs(percent)} % unter der Vorwoche.`,
    why: 'Summe des gewichteten Volumens der letzten 7 Tage gegenüber den 7 Tagen davor.',
    tone: percent > 0 ? 'positive' : 'neutral',
  };
}

/** Cardio minutes this week vs the weekly average of the previous four weeks. */
function cardioInsight(dataset: AnalyticsDataset, now: Date): CoachInsight | null {
  const thisWeek = Math.round(
    computeAnalytics(dataset, rangeDaysAgo(now, 6, 0), { now }).cardio
      .totalDurationSeconds / 60,
  );
  const priorMinutes =
    computeAnalytics(dataset, rangeDaysAgo(now, 34, 7), { now }).cardio
      .totalDurationSeconds / 60;
  if (thisWeek === 0 && priorMinutes === 0) return null;

  const priorPerWeek = Math.round(priorMinutes / 4);
  return {
    id: 'cardio-week',
    text: `Cardio diese Woche: ${thisWeek} Minuten.`,
    why: `Cardio-Minuten der letzten 7 Tage (${thisWeek}) gegenüber dem Schnitt der 4 Wochen davor (${priorPerWeek} pro Woche).`,
    tone: thisWeek >= priorPerWeek ? 'positive' : 'neutral',
  };
}

/**
 * Up to `limit` insights, most relevant first. Each rule is independent and may
 * yield nothing; the result is empty when the data does not support any insight.
 */
export function buildCoachInsights(
  dataset: AnalyticsDataset,
  now: Date = new Date(),
  limit = 3,
): CoachInsight[] {
  const insights = [
    frequencyInsight(dataset, now),
    volumeTrendInsight(dataset, now),
    cardioInsight(dataset, now),
  ].filter((insight): insight is CoachInsight => insight != null);
  return insights.slice(0, limit);
}
