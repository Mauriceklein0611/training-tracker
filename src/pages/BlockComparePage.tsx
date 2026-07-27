import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { MetricsCompareTable } from '@/features/analysis/MetricsCompareTable';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { loadAnalyticsDataset } from '@/services/dataset';
import { buildBlockComparisonExport, compareBlocks } from '@/services/blockComparison';
import { useToast } from '@/hooks/useToast';
import { copyToClipboard, downloadJson } from '@/utils/download';
import { customRange, dayKey, formatDate } from '@/utils/date';

const dayOffset = (days: number) => dayKey(new Date(Date.now() + days * 86400000));

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
          <MetricsCompareTable
            a={comparison.a}
            b={comparison.b}
            subA={
              <>
                {formatDate(comparison.a.fromKey)}–{formatDate(comparison.a.toKey)}
                <br />
                {comparison.a.weeks} Wo.
              </>
            }
            subB={
              <>
                {formatDate(comparison.b.fromKey)}–{formatDate(comparison.b.toKey)}
                <br />
                {comparison.b.weeks} Wo.
              </>
            }
          />

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
