import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsCompareTable } from '@/features/analysis/MetricsCompareTable';
import type { BlockMetrics } from '@/services/blockComparison';

function metrics(overrides: Partial<BlockMetrics> = {}): BlockMetrics {
  return {
    label: 'Block',
    fromKey: '2026-01-01',
    toKey: '2026-01-28',
    weeks: 4,
    sessions: 8,
    trainingDays: 8,
    durationSeconds: 3600,
    workingSets: 40,
    totalReps: 400,
    volumeKg: 12000,
    distinctExercises: 6,
    bestEstimatedOneRepMax: null,
    avgRir: null,
    avgRpe: null,
    restTargetMetRatio: null,
    avgRestDeviationSeconds: null,
    avgBodyWeightKg: null,
    avgBodyFatPercent: null,
    sessionsPerWeek: 2,
    workingSetsPerWeek: 10,
    volumePerWeekKg: 3000,
    durationPerWeekSeconds: 900,
    cardioActivities: 0,
    cardioDurationSeconds: 0,
    cardioDistanceMeters: 0,
    cardioActivitiesPerWeek: 0,
    cardioMinutesPerWeek: 0,
    cardioDistancePerWeekMeters: 0,
    ...overrides,
  };
}

describe('MetricsCompareTable cardio section', () => {
  it('shows the cardio section with totals and distance when a side has cardio', () => {
    const a = metrics({
      cardioActivities: 4,
      cardioDurationSeconds: 4 * 30 * 60, // 4 × 30 min
      cardioDistanceMeters: 20000, // 20 km total → 5 km avg
      cardioActivitiesPerWeek: 1,
      cardioMinutesPerWeek: 30,
      cardioDistancePerWeekMeters: 5000,
    });
    const b = metrics();

    render(<MetricsCompareTable a={a} b={b} labelA="A" labelB="B" />);

    expect(screen.getByText('Cardio')).toBeInTheDocument();
    // Total and average distance rendered in km, not merged into the strength side.
    expect(screen.getByText('20 km')).toBeInTheDocument();
    // 5 km appears as both the average-per-activity and the per-week distance.
    expect(screen.getAllByText('5 km').length).toBeGreaterThanOrEqual(1);
    // The cardio-free side reports honest "keine Daten" for its distance, not 0 km.
    expect(screen.getAllByText('keine Daten').length).toBeGreaterThan(0);
  });

  it('hides the cardio section entirely for two strength-only blocks', () => {
    render(<MetricsCompareTable a={metrics()} b={metrics()} />);
    expect(screen.queryByText('Cardio')).not.toBeInTheDocument();
  });

  it('shows a signed b − a delta for comparable numeric rows', () => {
    const a = metrics({ sessions: 8 });
    const b = metrics({ sessions: 11 });
    render(<MetricsCompareTable a={a} b={b} />);
    // 11 − 8 = +3 sessions.
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('shows no delta when one side has no data', () => {
    // avgBodyWeightKg is null on both sides → its Δ cell reads "–".
    render(<MetricsCompareTable a={metrics()} b={metrics()} />);
    // The dash placeholder is present for rows without a comparable delta.
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });
});
