import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionSummaryView } from '@/features/session/SessionSummaryView';
import type { SessionSummary } from '@/services/sessionSummary';
import type { NewRecord } from '@/services/metrics';
import { makeSession } from '@/tests/factories';

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    session: makeSession({ id: 's1' }),
    durationSeconds: 3600,
    exerciseCount: 3,
    workingSetCount: 9,
    totalReps: 90,
    volume: {
      volumeKg: 4500,
      addedWeightVolumeKg: 0,
      setsWithoutVolume: 0,
      setCount: 9,
      totalReps: 90,
      totalDurationSeconds: 0,
    },
    restStatistics: {
      evaluatedSets: 0,
      averageActualSeconds: null,
      averageTargetSeconds: null,
      targetMetRatio: null,
      averageDeviationSeconds: null,
    },
    newRecords: [],
    cardio: {
      activities: 0,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      totalCaloriesKcal: 0,
      totalElevationGainMeters: 0,
      averageHeartRateBpm: null,
    },
    hasCardio: false,
    hasStrength: true,
    cardioModality: undefined,
    cardioPace: null,
    cardioAvgRpe: null,
    calories: null,
    previousComparable: null,
    ...overrides,
  };
}

const record: NewRecord = {
  exerciseId: 'ex-bench',
  exerciseName: 'Bankdrücken',
  equipment: 'barbell',
  weightMode: 'total',
  kind: 'oneRepMax',
  label: 'Neues geschätztes 1RM',
  value: 91.7,
  previousValue: 88.4,
};

describe('SessionSummaryView celebration', () => {
  it('celebrates a real personal best', () => {
    render(<SessionSummaryView summary={summary({ newRecords: [record] })} />);
    expect(screen.getByText('Neue persönliche Bestleistung!')).toBeInTheDocument();
  });

  it('shows no celebration when there is no personal best', () => {
    render(<SessionSummaryView summary={summary()} />);
    expect(screen.queryByText(/persönliche Bestleistung/)).not.toBeInTheDocument();
  });

  it('treats first-time data as a baseline, not a celebrated record', () => {
    const baseline: NewRecord = {
      ...record,
      exerciseName: 'Kniebeuge',
      previousValue: null,
    };
    render(<SessionSummaryView summary={summary({ newRecords: [baseline] })} />);
    // No celebration for a first-ever value…
    expect(screen.queryByText(/persönliche Bestleistung/)).not.toBeInTheDocument();
    // …but a calm baseline note naming the exercise.
    expect(screen.getByText('Ausgangswert erstellt')).toBeInTheDocument();
    expect(screen.getByText(/Kniebeuge/)).toBeInTheDocument();
  });

  it('celebrates real records while noting baselines separately', () => {
    const baseline: NewRecord = {
      ...record,
      exerciseName: 'Kniebeuge',
      previousValue: null,
    };
    render(<SessionSummaryView summary={summary({ newRecords: [record, baseline] })} />);
    expect(screen.getByText('Neue persönliche Bestleistung!')).toBeInTheDocument();
    expect(screen.getByText('Ausgangswert erstellt')).toBeInTheDocument();
  });
});
