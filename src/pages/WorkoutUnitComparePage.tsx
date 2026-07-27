import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
  DELOAD_FILTER_LABELS,
  type DeloadFilter,
} from '@/services/analysisFilters';
import { customRange, dayKey, formatDate } from '@/utils/date';

const DELOAD_OPTIONS = (Object.keys(DELOAD_FILTER_LABELS) as DeloadFilter[]).map(
  (value) => ({ value, label: DELOAD_FILTER_LABELS[value] }),
);

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
      data.units.find((unit) => unit.id === unitId)?.name ?? 'Einheit';
    return compareWorkoutUnits(
      data.dataset,
      data.body,
      data.dayToUnitId,
      { unitId: aId, label: name(aId), range: rangeFor(aId) },
      { unitId: bId, label: name(bId), range: rangeFor(bId) },
      deload,
    );
  }, [data, aId, bId, deload]);

  return (
    <>
      <PageHeader
        title="Einheiten vergleichen"
        subtitle="Zwei Bibliotheks-Übungseinheiten nebeneinander"
        backTo="/analyse"
      />

      {units.length < 2 ? (
        <EmptyState
          title="Zu wenige genutzte Einheiten"
          description="Sobald mindestens zwei Übungseinheiten aus deiner Bibliothek trainiert wurden (direkt oder als Plan-Tag), kannst du sie hier vergleichen."
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader title="Einheiten" as="h2" />
            <div className="grid gap-3">
              <SelectField
                label="Einheit A"
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
                label="Einheit B"
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
                label="Deload"
                options={DELOAD_OPTIONS}
                value={deload}
                onChange={setDeload}
              />
            </div>
          </Card>

          {aId === bId ? (
            <p className="text-sm text-muted" role="status">
              Bitte zwei verschiedene Einheiten wählen.
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
                    {comparison.a.metrics.weeks} Wo.
                  </>
                }
                subB={
                  <>
                    {formatDate(comparison.b.metrics.fromKey)}–
                    {formatDate(comparison.b.metrics.toKey)}
                    <br />
                    {comparison.b.metrics.weeks} Wo.
                  </>
                }
              />
            </Card>
          ) : (
            <p className="text-sm text-muted" role="status">
              Vergleich wird berechnet …
            </p>
          )}
        </>
      )}
    </>
  );
}
