import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { CheckboxField, Segmented, SelectField } from '@/components/ui/Field';
import { ChartFrame, DataTable, TrendLineChart } from '@/features/analytics/Charts';
import {
  BODY_RANGE_LABELS,
  BODY_METRIC_OPTIONS,
  availableBodyMetrics,
  buildBodyMetricSeries,
  movingAverage,
  trendWindow,
  type BodyMetricRange,
  type BodyMetricUnit,
} from '@/services/bodyCharts';
import type { BodyWeightEntry } from '@/types';
import { formatCm, formatKg, formatPercentValue } from '@/utils/format';
import { formatDate } from '@/utils/date';

const RANGE_OPTIONS: { value: BodyMetricRange; label: string }[] = [
  { value: '4w', label: '4 Wo.' },
  { value: '12w', label: '12 Wo.' },
  { value: '6m', label: '6 Mon.' },
  { value: 'all', label: 'Alles' },
];

function formatByUnit(unit: BodyMetricUnit): (value: number) => string {
  if (unit === 'kg') return (value) => formatKg(value);
  if (unit === '%') return (value) => formatPercentValue(value);
  return (value) => formatCm(value);
}

/** Body-data diagrams: one selectable series over a chosen timeframe. */
export function BodyMetricChart({ entries }: { entries: BodyWeightEntry[] }) {
  const available = useMemo(() => availableBodyMetrics(entries), [entries]);
  const [metricKey, setMetricKey] = useState<string>('weightKg');
  const [range, setRange] = useState<BodyMetricRange>('12w');
  const [showTrend, setShowTrend] = useState(true);

  // Fall back to the first metric that actually has data.
  const activeKey = available.some((option) => option.key === metricKey)
    ? metricKey
    : (available[0]?.key ?? 'weightKg');
  const option =
    BODY_METRIC_OPTIONS.find((entry) => entry.key === activeKey) ??
    BODY_METRIC_OPTIONS[0];

  const series = useMemo(
    () => buildBodyMetricSeries(entries, activeKey, range),
    [entries, activeKey, range],
  );

  const trendEnabled = showTrend && series.length >= 4;
  const chartData = useMemo(() => {
    const trend = trendEnabled
      ? movingAverage(
          series.map((point) => point.value),
          trendWindow(series.length),
        )
      : null;
    return series.map((point, index) => ({
      label: formatDate(point.date).slice(0, 6),
      value: Math.round(point.value * 100) / 100,
      trend: trend ? trend[index] : null,
    }));
  }, [series, trendEnabled]);

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader title="Diagramme" as="h2" />
        <p className="text-sm text-muted">
          Sobald du eine Messreihe an mindestens zwei Tagen erfasst hast, erscheint hier
          ihr Verlauf.
        </p>
      </Card>
    );
  }

  const formatValue = formatByUnit(option.unit);
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const change = first != null && last != null ? last - first : null;

  const summary =
    series.length === 0
      ? 'Für diesen Zeitraum liegen keine Messungen vor.'
      : `${option.label}: ${series.length} Messungen im Zeitraum ${BODY_RANGE_LABELS[range]}. ` +
        `Zuletzt ${formatValue(last as number)}` +
        (change != null
          ? `, Veränderung ${change > 0 ? '+' : ''}${formatValue(change)} seit Beginn des Zeitraums.`
          : '.');

  return (
    <Card>
      <CardHeader title="Diagramme" subtitle="Verlauf einer Messreihe" as="h2" />
      <div className="grid gap-2">
        <SelectField
          label="Messreihe"
          value={activeKey}
          onChange={(event) => setMetricKey(event.target.value)}
        >
          {available.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </SelectField>
        <Segmented
          label="Zeitraum"
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
        />
        <CheckboxField
          label="Gleitenden Trend anzeigen"
          hint="Geglätteter Verlauf derselben Messreihe. Die Rohwerte bleiben sichtbar."
          checked={showTrend}
          onChange={setShowTrend}
        />
      </div>

      <div className="mt-3">
        <ChartFrame
          title={option.label}
          empty={series.length === 0}
          summary={summary}
          table={
            <DataTable
              caption={`${option.label} je Messung`}
              columns={trendEnabled ? ['Datum', 'Wert', 'Trend'] : ['Datum', 'Wert']}
              rows={chartData.map((point, index) =>
                trendEnabled
                  ? [
                      formatDate(series[index].date),
                      formatValue(point.value),
                      point.trend != null ? formatValue(point.trend) : '–',
                    ]
                  : [formatDate(series[index].date), formatValue(point.value)],
              )}
            />
          }
        >
          <TrendLineChart
            data={chartData}
            formatValue={formatValue}
            showTrend={trendEnabled}
          />
        </ChartFrame>
      </div>
    </Card>
  );
}
