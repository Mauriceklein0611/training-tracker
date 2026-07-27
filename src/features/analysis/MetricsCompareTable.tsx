import type { ReactNode } from 'react';
import type { BlockMetrics } from '@/services/blockComparison';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatPercentValue,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';
import { formatDurationLong } from '@/utils/date';

/** One comparison row; a missing value is shown honestly rather than as zero. */
function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] items-baseline gap-2 border-t border-border py-1.5 first:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="numeric text-right text-sm font-medium">{a}</span>
      <span className="numeric text-right text-sm font-medium">{b}</span>
    </div>
  );
}

function num(
  value: number | null | undefined,
  format: (value: number) => string,
): string {
  return value == null ? 'keine Daten' : format(value);
}

function Section({
  title,
  a,
  b,
  rows,
}: {
  title: string;
  a: BlockMetrics;
  b: BlockMetrics;
  rows: { label: string; get: (metrics: BlockMetrics) => string }[];
}) {
  return (
    <div className="mt-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {rows.map((row) => (
        <Row key={row.label} label={row.label} a={row.get(a)} b={row.get(b)} />
      ))}
    </div>
  );
}

/**
 * Side-by-side metrics table shared by the block and plan comparison screens.
 * Purely presentational: it renders the two already-computed {@link BlockMetrics}
 * and never estimates a missing value or draws a conclusion.
 */
export function MetricsCompareTable({
  a,
  b,
  labelA = 'A',
  labelB = 'B',
  subA,
  subB,
}: {
  a: BlockMetrics;
  b: BlockMetrics;
  labelA?: string;
  labelB?: string;
  subA?: ReactNode;
  subB?: ReactNode;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 text-xs">
        <span />
        <span className="text-right font-semibold text-accent">
          {labelA}
          {subA ? (
            <>
              <br />
              <span className="font-normal text-muted">{subA}</span>
            </>
          ) : null}
        </span>
        <span className="text-right font-semibold text-accent">
          {labelB}
          {subB ? (
            <>
              <br />
              <span className="font-normal text-muted">{subB}</span>
            </>
          ) : null}
        </span>
      </div>

      <Section
        title="Absolut"
        a={a}
        b={b}
        rows={[
          { label: 'Einheiten', get: (m) => formatNumber(m.sessions) },
          { label: 'Trainingstage', get: (m) => formatNumber(m.trainingDays) },
          { label: 'Dauer gesamt', get: (m) => formatDurationLong(m.durationSeconds) },
          { label: 'Arbeitssätze', get: (m) => formatNumber(m.workingSets) },
          { label: 'Wiederholungen', get: (m) => formatNumber(m.totalReps) },
          { label: 'Volumen', get: (m) => formatVolume(m.volumeKg) },
          { label: 'Versch. Übungen', get: (m) => formatNumber(m.distinctExercises) },
        ]}
      />

      <Section
        title="Pro Woche (normalisiert)"
        a={a}
        b={b}
        rows={[
          { label: 'Einheiten / Wo.', get: (m) => formatNumber(m.sessionsPerWeek, 1) },
          { label: 'Sätze / Wo.', get: (m) => formatNumber(m.workingSetsPerWeek, 1) },
          { label: 'Volumen / Wo.', get: (m) => formatVolume(m.volumePerWeekKg) },
          {
            label: 'Dauer / Wo.',
            get: (m) => formatDurationLong(m.durationPerWeekSeconds),
          },
        ]}
      />

      <Section
        title="Durchschnitte"
        a={a}
        b={b}
        rows={[
          { label: 'Ø RIR', get: (m) => num(m.avgRir, (v) => formatNumber(v, 1)) },
          { label: 'Ø RPE', get: (m) => num(m.avgRpe, (v) => formatNumber(v, 1)) },
          {
            label: 'Pausenziel erreicht',
            get: (m) => num(m.restTargetMetRatio, formatPercent),
          },
          {
            label: 'Ø Pausenabweichung',
            get: (m) => num(m.avgRestDeviationSeconds, formatSignedSeconds),
          },
          {
            label: 'Ø Körpergewicht',
            get: (m) => num(m.avgBodyWeightKg, (v) => formatKg(v)),
          },
          {
            label: 'Ø Körperfett',
            get: (m) => num(m.avgBodyFatPercent, formatPercentValue),
          },
        ]}
      />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        „keine Daten" bedeutet, dass für diesen Zeitraum nichts erfasst wurde. Es werden
        keine Werte geschätzt und keine Schlüsse gezogen — die Einordnung bleibt dir
        überlassen.
      </p>
    </div>
  );
}
