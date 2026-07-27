import { Trophy } from 'lucide-react';
import { Stat } from '@/components/ui/Card';
import { equipmentLabel } from '@/services/equipment';
import type { SessionSummary } from '@/services/sessionSummary';
import { formatDurationLong } from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';

/** Shared summary block, used both when finishing and when reviewing a workout. */
export function SessionSummaryView({ summary }: { summary: SessionSummary }) {
  const { restStatistics: rest } = summary;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Dauer"
          value={
            summary.durationSeconds == null
              ? '–'
              : formatDurationLong(summary.durationSeconds)
          }
          tone="accent"
        />
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
          Zusätzlich {formatKg(summary.volume.addedWeightVolumeKg)} Zusatzgewichtsvolumen
          bei Körpergewichtsübungen.
        </p>
      ) : null}

      {summary.volume.setsWithoutVolume > 0 ? (
        <p className="text-xs text-muted">
          {summary.volume.setsWithoutVolume} Sätze ohne berechenbares Kilogramm-Volumen
          (Körpergewicht, unterstützt oder zeitbasiert). Diese werden bewusst nicht in kg
          bewertet.
        </p>
      ) : null}

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
