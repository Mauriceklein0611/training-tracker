import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { loadAnalyticsDataset } from '@/services/dataset';
import {
  buildBlockComparisonExport,
  compareBlocks,
  type BlockMetrics,
} from '@/services/blockComparison';
import { useToast } from '@/hooks/useToast';
import { copyToClipboard, downloadJson } from '@/utils/download';
import { customRange, dayKey, formatDate, formatDurationLong } from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatPercentValue,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';

const dayOffset = (days: number) => dayKey(new Date(Date.now() + days * 86400000));

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
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 pb-1 text-xs font-semibold text-muted">
        <span>Kennzahl</span>
        <span className="text-right">A</span>
        <span className="text-right">B</span>
      </div>
      {rows.map((row) => (
        <Row key={row.label} label={row.label} a={row.get(a)} b={row.get(b)} />
      ))}
    </div>
  );
}

export default function BlockComparePage() {
  const toast = useToast();
  const [aFrom, setAFrom] = useState(() => dayOffset(-55));
  const [aTo, setATo] = useState(() => dayOffset(-28));
  const [bFrom, setBFrom] = useState(() => dayOffset(-27));
  const [bTo, setBTo] = useState(() => dayOffset(0));

  const data = useLiveQuery(async () => {
    const [dataset, body] = await Promise.all([
      loadAnalyticsDataset(),
      listBodyWeightEntries(),
    ]);
    return { dataset, body };
  }, []);

  const validA = aFrom <= aTo;
  const validB = bFrom <= bTo;

  const comparison = useMemo(() => {
    if (!data || !validA || !validB) return null;
    return compareBlocks(
      data.dataset,
      data.body,
      customRange(aFrom, aTo),
      customRange(bFrom, bTo),
      { a: 'Block A', b: 'Block B' },
    );
  }, [data, aFrom, aTo, bFrom, bTo, validA, validB]);

  const handleExport = (mode: 'download' | 'copy') => {
    if (!comparison) return;
    const payload = buildBlockComparisonExport(comparison);
    if (mode === 'download') {
      downloadJson(`trainingsblock-vergleich-${dayKey(new Date())}.json`, payload);
      toast.show('Vergleich als Datei exportiert.', 'success');
    } else {
      void copyToClipboard(JSON.stringify(payload, null, 2)).then((ok) =>
        toast.show(
          ok ? 'Vergleich für die KI kopiert.' : 'Kopieren nicht möglich.',
          ok ? 'success' : 'error',
        ),
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Blöcke vergleichen"
        subtitle="Zwei frei wählbare Zeiträume nebeneinander"
        backTo="/analyse"
      />

      <Card className="mb-4">
        <CardHeader title="Zeiträume" as="h2" />
        <div className="grid gap-3">
          <div>
            <p className="mb-1 text-sm font-medium">Block A</p>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Von"
                type="date"
                value={aFrom}
                onChange={(e) => setAFrom(e.target.value)}
              />
              <TextField
                label="Bis"
                type="date"
                value={aTo}
                error={validA ? undefined : 'Bis vor Von'}
                onChange={(e) => setATo(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Block B</p>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Von"
                type="date"
                value={bFrom}
                onChange={(e) => setBFrom(e.target.value)}
              />
              <TextField
                label="Bis"
                type="date"
                value={bTo}
                error={validB ? undefined : 'Bis vor Von'}
                onChange={(e) => setBTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {!comparison ? (
        <p className="text-sm text-muted" role="status">
          {validA && validB
            ? 'Vergleich wird berechnet …'
            : 'Bitte gültige Zeiträume wählen.'}
        </p>
      ) : (
        <Card>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 text-xs">
            <span />
            <span className="text-right font-semibold text-accent">
              A<br />
              <span className="font-normal text-muted">
                {formatDate(comparison.a.fromKey)}–{formatDate(comparison.a.toKey)}
                <br />
                {comparison.a.weeks} Wo.
              </span>
            </span>
            <span className="text-right font-semibold text-accent">
              B<br />
              <span className="font-normal text-muted">
                {formatDate(comparison.b.fromKey)}–{formatDate(comparison.b.toKey)}
                <br />
                {comparison.b.weeks} Wo.
              </span>
            </span>
          </div>

          <Section
            title="Absolut"
            a={comparison.a}
            b={comparison.b}
            rows={[
              { label: 'Einheiten', get: (m) => formatNumber(m.sessions) },
              { label: 'Trainingstage', get: (m) => formatNumber(m.trainingDays) },
              {
                label: 'Dauer gesamt',
                get: (m) => formatDurationLong(m.durationSeconds),
              },
              { label: 'Arbeitssätze', get: (m) => formatNumber(m.workingSets) },
              { label: 'Wiederholungen', get: (m) => formatNumber(m.totalReps) },
              { label: 'Volumen', get: (m) => formatVolume(m.volumeKg) },
              { label: 'Versch. Übungen', get: (m) => formatNumber(m.distinctExercises) },
            ]}
          />

          <Section
            title="Pro Woche (normalisiert)"
            a={comparison.a}
            b={comparison.b}
            rows={[
              {
                label: 'Einheiten / Wo.',
                get: (m) => formatNumber(m.sessionsPerWeek, 1),
              },
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
            a={comparison.a}
            b={comparison.b}
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
            „keine Daten“ bedeutet, dass für diesen Zeitraum nichts erfasst wurde. Es
            werden keine Werte geschätzt und keine Schlüsse gezogen — die Einordnung
            bleibt dir überlassen.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => handleExport('copy')}>
              <Copy size={18} aria-hidden="true" />
              Für KI kopieren
            </Button>
            <Button variant="secondary" onClick={() => handleExport('download')}>
              <Download size={18} aria-hidden="true" />
              Als Datei
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
