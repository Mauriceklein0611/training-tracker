import { Activity, Trophy } from 'lucide-react';
import { Stat } from '@/components/ui/Card';
import { equipmentLabel } from '@/services/equipment';
import type { SessionSummary } from '@/services/sessionSummary';
import {
  formatCardioDistance,
  formatDuration as formatCardioDuration,
  formatPace,
} from '@/services/cardioMetrics';
import { formatDate, formatDurationLong } from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatSets,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';

/** Shared summary block, used both when finishing and when reviewing a workout. */
export function SessionSummaryView({ summary }: { summary: SessionSummary }) {
  const { restStatistics: rest } = summary;
  // A pure-cardio session leads with cardio; the strength grid (which would be
  // all zeros and dashes) is suppressed so it never dominates before Dauer,
  // Distanz, Pace and the cardio figures.
  const cardioOnly = summary.hasCardio && !summary.hasStrength;

  const duration =
    summary.durationSeconds == null ? '–' : formatDurationLong(summary.durationSeconds);

  // Comparison to the last comparable session — only shown when a delta exists.
  const prev = summary.previousComparable;
  const comparisonDelta =
    prev?.volumeDeltaPercent != null
      ? { value: prev.volumeDeltaPercent, unit: 'Volumen' }
      : prev?.cardioDurationDeltaPercent != null
        ? { value: prev.cardioDurationDeltaPercent, unit: 'Cardio-Dauer' }
        : null;

  const cardioBlock = summary.hasCardio ? (
    <div className="rounded-2xl border border-cardio/40 bg-surface p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Activity size={18} aria-hidden="true" className="text-cardio" />
        Cardio
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Aktivitäten" value={formatNumber(summary.cardio.activities)} />
        <Stat
          label="Cardio-Dauer"
          value={formatCardioDuration(summary.cardio.totalDurationSeconds)}
        />
        {summary.cardio.totalDistanceMeters > 0 ? (
          <Stat
            label="Distanz"
            value={formatCardioDistance(
              summary.cardio.totalDistanceMeters,
              summary.cardioModality,
            )}
          />
        ) : null}
        {summary.cardioPace ? (
          <Stat label="Pace / Tempo" value={formatPace(summary.cardioPace)} />
        ) : null}
        {summary.cardioAvgRpe != null ? (
          <Stat label="Ø RPE" value={formatNumber(summary.cardioAvgRpe, 1)} />
        ) : null}
        {summary.cardio.averageHeartRateBpm != null ? (
          <Stat
            label="Ø Herzfrequenz"
            value={`${Math.round(summary.cardio.averageHeartRateBpm)} bpm`}
            hint="aufgezeichnet"
          />
        ) : null}
        {summary.cardio.totalCaloriesKcal > 0 ? (
          <Stat
            label="Kalorien"
            value={`${formatNumber(summary.cardio.totalCaloriesKcal)} kcal`}
            hint="erfasst"
          />
        ) : null}
        {summary.cardio.totalElevationGainMeters > 0 ? (
          <Stat
            label="Höhenmeter"
            value={`${formatNumber(summary.cardio.totalElevationGainMeters)} m`}
          />
        ) : null}
      </div>
    </div>
  ) : null;

  const recordCount = summary.newRecords.length;

  return (
    <div className="grid gap-3">
      {recordCount > 0 ? (
        <div className="celebrate overflow-hidden rounded-2xl border border-success/50 bg-surface p-4">
          <div className="celebrate-sheen">
            <p className="flex items-center gap-2 text-base font-semibold text-success">
              <Trophy size={20} aria-hidden="true" />
              {recordCount === 1
                ? 'Neue persönliche Bestleistung!'
                : `${recordCount} neue persönliche Bestleistungen!`}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Starke Einheit — die Details stehen unten.
            </p>
          </div>
        </div>
      ) : null}

      {comparisonDelta ? (
        <div
          className={
            comparisonDelta.value >= 0
              ? 'rounded-2xl border border-success/40 bg-surface p-3 text-sm'
              : 'rounded-2xl border border-border bg-surface p-3 text-sm'
          }
        >
          <span
            className={
              comparisonDelta.value >= 0
                ? 'numeric font-semibold text-success'
                : 'numeric font-semibold text-warning'
            }
          >
            {comparisonDelta.value >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(comparisonDelta.value), 0)} % {comparisonDelta.unit}
          </span>{' '}
          <span className="text-muted">
            gegenüber der letzten vergleichbaren Einheit
            {prev ? ` (${formatDate(prev.startedAt)})` : ''}
          </span>
        </div>
      ) : null}

      {cardioOnly ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Dauer" value={duration} tone="accent" />
            <Stat label="Übungen" value={formatNumber(summary.exerciseCount)} />
          </div>
          {cardioBlock}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Dauer" value={duration} tone="accent" />
            <Stat label="Übungen" value={formatNumber(summary.exerciseCount)} />
            <Stat label="Arbeitssätze" value={formatNumber(summary.workingSetCount)} />
            <Stat label="Wiederholungen" value={formatNumber(summary.totalReps)} />
            <Stat
              label="Volumen"
              value={formatVolume(summary.volume.volumeKg)}
              hint="nur gewichtete Übungen"
            />
            <Stat
              label="Ø Pausenabw."
              value={formatSignedSeconds(rest.averageDeviationSeconds)}
              hint={
                rest.evaluatedSets > 0
                  ? `${formatPercent(rest.targetMetRatio)} erreicht`
                  : 'keine Pausen erfasst'
              }
            />
          </div>

          {summary.volume.addedWeightVolumeKg > 0 ? (
            <p className="text-xs text-muted">
              Zusätzlich {formatKg(summary.volume.addedWeightVolumeKg)}{' '}
              Zusatzgewichtsvolumen bei Körpergewichtsübungen.
            </p>
          ) : null}

          {summary.volume.setsWithoutVolume > 0 ? (
            <p className="text-xs text-muted">
              {formatSets(summary.volume.setsWithoutVolume)} ohne berechenbares
              Kilogramm-Volumen (Körpergewicht, unterstützt oder zeitbasiert). Diese
              werden bewusst nicht in kg bewertet.
            </p>
          ) : null}

          {cardioBlock}
        </>
      )}

      {summary.newRecords.length > 0 ? (
        <div className="rounded-2xl border border-success/50 bg-surface p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
            <Trophy size={18} aria-hidden="true" />
            Neue persönliche Bestleistungen
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {summary.newRecords.map((record) => (
              <li
                key={`${record.exerciseId} ${record.equipment} ${record.weightMode} ${record.kind}`}
                className="text-sm"
              >
                <span className="font-medium">{record.exerciseName}</span>
                {record.equipment !== 'unspecified' ? (
                  <span className="text-muted">
                    {' '}
                    · {equipmentLabel(record.equipment)}
                  </span>
                ) : null}
                <span className="text-muted"> — {record.label}: </span>
                <span className="numeric font-semibold">
                  {record.kind === 'reps'
                    ? `${formatNumber(record.value)} Wdh.`
                    : record.kind === 'duration'
                      ? `${formatNumber(record.value)} s`
                      : formatKg(record.value)}
                </span>
                {record.previousValue != null ? (
                  <span className="text-xs text-muted">
                    {' '}
                    (vorher{' '}
                    {record.kind === 'reps'
                      ? formatNumber(record.previousValue)
                      : record.kind === 'duration'
                        ? `${formatNumber(record.previousValue)} s`
                        : formatKg(record.previousValue)}
                    )
                  </span>
                ) : (
                  <span className="text-xs text-muted"> (erstmals erfasst)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
