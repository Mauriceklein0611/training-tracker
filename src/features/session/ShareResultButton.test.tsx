import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareResultButton } from '@/features/session/ShareResultButton';
import { ToastProvider } from '@/components/ui/ToastProvider';
import type { SessionSummary } from '@/services/sessionSummary';
import { makeSession } from '@/tests/factories';

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    session: makeSession({ id: 's1', startedAt: '2026-07-28T10:00:00.000Z' }),
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
      averageDeviationSeconds: null,
      targetMetRatio: null,
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

describe('ShareResultButton', () => {
  it('opens a local preview that promises no body data', async () => {
    render(
      <ToastProvider>
        <ShareResultButton summary={summary()} />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Ergebnis teilen/ }));

    const dialog = screen.getByRole('dialog', { name: 'Ergebnis teilen' });
    expect(dialog).toBeInTheDocument();
    // The preview is a local data-URL image — never a remote source.
    const img = screen.getByAltText('Vorschau der Ergebnisgrafik') as HTMLImageElement;
    expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(screen.getByText(/keine Körperdaten/)).toBeInTheDocument();
  });
});
