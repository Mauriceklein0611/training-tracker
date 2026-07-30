import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '@/db/db';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { SelectField, Segmented } from '@/components/ui/Field';
import { MetricsCompareTable } from '@/features/analysis/MetricsCompareTable';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { listWorkoutUnits } from '@/db/repositories/workoutUnits';
import { loadAnalyticsDataset } from '@/services/dataset';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  compareWorkoutUnits,
  sessionWorkoutUnitId,
  type DeloadFilter,
} from '@/services/analysisFilters';
import { customRange, dayKey, formatDate } from '@/utils/date';

const DELOAD_FILTERS: readonly DeloadFilter[] = ['include', 'exclude', 'only'];

/** The completed-session span attributed to one workout unit. */
function unitSessionSpan(
  dataset: AnalyticsDataset,
  unitId: string,
  dayToUnitId: Map<string, string>,
): { from: string; to: string } | null {
  const dates = dataset.sessions
    .filter(
      (session) =>
        session.status === 'completed' &&
        sessionWorkoutUnitId(session, dayToUnitId) === unitId,
    )
    .map((session) => dayKey(session.finishedAt ?? session.startedAt));
  if (dates.length === 0) return null;
  return {
    from: dates.reduce((min, d) => (d < min ? d : min), dates[0]),
    to: dates.reduce((max, d) => (d > max ? d : max), dates[0]),
  };
}

/** Compares two library workout units side by side over their own spans (Phase 6). */
export default function WorkoutUnitComparePage() {
  const { t } = useTranslation('library');
  const data = useLiveQuery(async () => {
    const [dataset, body, units, days] = await Promise.all([
      loadAnalyticsDataset(),
      listBodyWeightEntries(),
      listWorkoutUnits(true),
      db.workoutTemplates.toArray(),
    ]);
    // Plan day → the library unit it was copied from (copy-on-add provenance).
    const dayToUnitId = new Map<string, string>();
    for (const day of days) {
      if (day.sourceWorkoutUnitTemplateId) {
        dayToUnitId.set(day.id, day.sourceWorkoutUnitTemplateId);
      }
    }
    // Only units that actually have attributed sessions are worth comparing.
    const usedUnitIds = new Set(
      dataset.sessions
        .map((session) => sessionWorkoutUnitId(session, dayToUnitId))
        .filter((id): id is string => Boolean(id)),
    );
    const comparable = units.filter((unit) => usedUnitIds.has(unit.id));
    return { dataset, body, units: comparable, dayToUnitId };
  }, []);

  const [unitA, setUnitA] = useState('');
  const [unitB, setUnitB] = useState('');
  const [deload, setDeload] = useState<DeloadFilter>('include');
  const deloadOptions = DELOAD_FILTERS.map((value) => ({
    value,
    label: t(`compare.deloadOptions.${value}`),
  }));

  const units = data?.units ?? [];
  const aId = unitA || units[0]?.id || '';
  const bId = unitB || units[1]?.id || units[0]?.id || '';

  const comparison = useMemo(() => {
    if (!data || !aId || !bId || aId === bId) return null;
    const rangeFor = (unitId: string) => {
      const span = unitSessionSpan(data.dataset, unitId, data.dayToUnitId);
      const today = dayKey(new Date());
      return customRange(span?.from ?? today, span?.to ?? today);
    };
    const name = (unitId: string) =>
      data.units.find((unit) => unit.id === unitId)?.name ?? t('unit.fallbackName');
    return compareWorkoutUnits(
      data.dataset,
      data.body,
      data.dayToUnitId,
      { unitId: aId, label: name(aId), range: rangeFor(aId) },
      { unitId: bId, label: name(bId), range: rangeFor(bId) },
      deload,
    );
  }, [data, aId, bId, deload, t]);

  return (
    <>
      <PageHeader
        title={t('compare.title')}
        subtitle={t('compare.subtitle')}
        backTo="/analyse"
      />

      {units.length < 2 ? (
        <EmptyState
          title={t('compare.empty.title')}
          description={t('compare.empty.description')}
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader title={t('compare.units')} as="h2" />
            <div className="grid gap-3">
              <SelectField
                label={t('compare.unitA')}
                value={aId}
                onChange={(event) => setUnitA(event.target.value)}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('compare.unitB')}
                value={bId}
                onChange={(event) => setUnitB(event.target.value)}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </SelectField>
              <Segmented
                label={t('compare.deload')}
                options={deloadOptions}
                value={deload}
                onChange={setDeload}
              />
            </div>
          </Card>

          {aId === bId ? (
            <p className="text-sm text-muted" role="status">
              {t('compare.chooseDifferent')}
            </p>
          ) : comparison ? (
            <Card>
              <MetricsCompareTable
                a={comparison.a.metrics}
                b={comparison.b.metrics}
                labelA={comparison.a.label}
                labelB={comparison.b.label}
                subA={
                  <>
                    {formatDate(comparison.a.metrics.fromKey)}–
                    {formatDate(comparison.a.metrics.toKey)}
                    <br />
                    {t('compare.weekShort', {
                      count: comparison.a.metrics.weeks,
                    })}
                  </>
                }
                subB={
                  <>
                    {formatDate(comparison.b.metrics.fromKey)}–
                    {formatDate(comparison.b.metrics.toKey)}
                    <br />
                    {t('compare.weekShort', {
                      count: comparison.b.metrics.weeks,
                    })}
                  </>
                }
              />
            </Card>
          ) : (
            <p className="text-sm text-muted" role="status">
              {t('compare.calculating')}
            </p>
          )}
        </>
      )}
    </>
  );
}
