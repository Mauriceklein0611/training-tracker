import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader } from '@/components/ui/Card';
import { CheckboxField, Segmented, SelectField } from '@/components/ui/Field';
import { ChartFrame, DataTable, TrendLineChart } from '@/features/analytics/Charts';
import {
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

const RANGE_VALUES: BodyMetricRange[] = ['4w', '12w', '6m', 'all'];

function metricLabel(t: TFunction<'more'>, key: string): string {
  switch (key) {
    case 'weightKg':
      return t('screens.body.chart.metrics.weightKg');
    case 'bodyFatPercent':
      return t('screens.body.chart.metrics.bodyFatPercent');
    case 'neckCm':
      return t('screens.body.chart.metrics.neckCm');
    case 'shoulderCm':
      return t('screens.body.chart.metrics.shoulderCm');
    case 'chestCm':
      return t('screens.body.chart.metrics.chestCm');
    case 'waistCm':
      return t('screens.body.chart.metrics.waistCm');
    case 'hipCm':
      return t('screens.body.chart.metrics.hipCm');
    case 'bicepsLeftCm':
      return t('screens.body.chart.metrics.bicepsLeftCm');
    case 'bicepsRightCm':
      return t('screens.body.chart.metrics.bicepsRightCm');
    case 'forearmLeftCm':
      return t('screens.body.chart.metrics.forearmLeftCm');
    case 'forearmRightCm':
      return t('screens.body.chart.metrics.forearmRightCm');
    case 'thighLeftCm':
      return t('screens.body.chart.metrics.thighLeftCm');
    case 'thighRightCm':
      return t('screens.body.chart.metrics.thighRightCm');
    case 'calfLeftCm':
      return t('screens.body.chart.metrics.calfLeftCm');
    case 'calfRightCm':
      return t('screens.body.chart.metrics.calfRightCm');
    default:
      return key;
  }
}

function formatByUnit(unit: BodyMetricUnit): (value: number) => string {
  if (unit === 'kg') return (value) => formatKg(value);
  if (unit === '%') return (value) => formatPercentValue(value);
  return (value) => formatCm(value);
}

/** Body-data diagrams: one selectable series over a chosen timeframe. */
export function BodyMetricChart({ entries }: { entries: BodyWeightEntry[] }) {
  const { t } = useTranslation('more');
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
        <CardHeader title={t('screens.body.chart.title')} as="h2" />
        <p className="text-sm text-muted">{t('screens.body.chart.insufficient')}</p>
      </Card>
    );
  }

  const formatValue = formatByUnit(option.unit);
  const optionLabel = metricLabel(t, option.key);
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;
  const change = first != null && last != null ? last - first : null;

  const summary =
    series.length === 0
      ? t('screens.body.chart.noMeasurements')
      : t('screens.body.chart.summary', {
          label: optionLabel,
          amount: series.length,
          range: t(`screens.body.chart.rangeLong.${range}`),
          latest: formatValue(last as number),
          change:
            change != null
              ? t('screens.body.chart.change', {
                  value: `${change > 0 ? '+' : ''}${formatValue(change)}`,
                })
              : t('screens.body.chart.noChange'),
        });

  return (
    <Card>
      <CardHeader
        title={t('screens.body.chart.title')}
        subtitle={t('screens.body.chart.subtitle')}
        as="h2"
      />
      <div className="grid gap-2">
        <SelectField
          label={t('screens.body.chart.series')}
          value={activeKey}
          onChange={(event) => setMetricKey(event.target.value)}
        >
          {available.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {metricLabel(t, entry.key)}
            </option>
          ))}
        </SelectField>
        <Segmented
          label={t('screens.body.chart.range')}
          options={RANGE_VALUES.map((value) => ({
            value,
            label: t(`screens.body.chart.ranges.${value}`),
          }))}
          value={range}
          onChange={setRange}
        />
        <CheckboxField
          label={t('screens.body.chart.showTrend')}
          hint={t('screens.body.chart.trendHint')}
          checked={showTrend}
          onChange={setShowTrend}
        />
      </div>

      <div className="mt-3">
        <ChartFrame
          title={optionLabel}
          empty={series.length === 0}
          summary={summary}
          table={
            <DataTable
              caption={t('screens.body.chart.caption', { label: optionLabel })}
              columns={
                trendEnabled
                  ? [
                      t('screens.body.chart.columns.date'),
                      t('screens.body.chart.columns.value'),
                      t('screens.body.chart.columns.trend'),
                    ]
                  : [
                      t('screens.body.chart.columns.date'),
                      t('screens.body.chart.columns.value'),
                    ]
              }
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
