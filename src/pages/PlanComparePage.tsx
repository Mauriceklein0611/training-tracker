import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { SelectField, Segmented } from '@/components/ui/Field';
import { MetricsCompareTable } from '@/features/analysis/MetricsCompareTable';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { listPlansWithDays } from '@/db/repositories/plans';
import { listUsagePeriods } from '@/db/repositories/planUsage';
import { loadAnalyticsDataset } from '@/services/dataset';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  comparePlans,
  planUsagePeriodsOverlap,
  planUsageSpan,
  DELOAD_FILTER_LABELS,
  type DeloadFilter,
} from '@/services/analysisFilters';
import { customRange, dayKey, formatDate } from '@/utils/date';

const DELOAD_OPTIONS = (Object.keys(DELOAD_FILTER_LABELS) as DeloadFilter[]).map(
  (value) => ({ value, label: DELOAD_FILTER_LABELS[value] }),
);

/** The completed-session span of a plan, as a fallback when it has no usage history. */
function sessionSpan(
  dataset: AnalyticsDataset,
  planId: string,
): { from: string; to: string } | null {
  const dates = dataset.sessions
    .filter((session) => session.planId === planId && session.status === 'completed')
    .map((session) => dayKey(session.finishedAt ?? session.startedAt));
  if (dates.length === 0) return null;
  return {
    from: dates.reduce((min, d) => (d < min ? d : min), dates[0]),
    to: dates.reduce((max, d) => (d > max ? d : max), dates[0]),
  };
}

/** Compares two plans side by side over each plan's own active span (Phase 6). */
export default function PlanComparePage() {
  const data = useLiveQuery(async () => {
    const [dataset, body, plansWithDays, usagePeriods] = await Promise.all([
      loadAnalyticsDataset(),
      listBodyWeightEntries(),
      listPlansWithDays(),
      listUsagePeriods(),
    ]);
    return { dataset, body, plans: plansWithDays.map((p) => p.plan), usagePeriods };
  }, []);

  const [planA, setPlanA] = useState('');
  const [planB, setPlanB] = useState('');
  const [deload, setDeload] = useState<DeloadFilter>('include');

  const plans = data?.plans ?? [];
  // Default to the first two plans once they are loaded.
  const aId = planA || plans[0]?.id || '';
  const bId = planB || plans[1]?.id || plans[0]?.id || '';

  const comparison = useMemo(() => {
    if (!data || !aId || !bId || aId === bId) return null;
    const rangeFor = (planId: string) => {
      const span =
        planUsageSpan(data.usagePeriods, planId) ?? sessionSpan(data.dataset, planId);
      const today = dayKey(new Date());
      return customRange(span?.from ?? today, span?.to ?? today);
    };
    const name = (planId: string) =>
      data.plans.find((plan) => plan.id === planId)?.name ?? 'Plan';
    const uncertain = planUsagePeriodsOverlap(data.usagePeriods, aId, bId);
    return {
      ...comparePlans(
        data.dataset,
        data.body,
        {
          planId: aId,
          label: name(aId),
          range: rangeFor(aId),
          usageUncertain: uncertain,
        },
        {
          planId: bId,
          label: name(bId),
          range: rangeFor(bId),
          usageUncertain: uncertain,
        },
        deload,
      ),
      uncertain,
    };
  }, [data, aId, bId, deload]);

  return (
    <>
      <PageHeader
        title="Pläne vergleichen"
        subtitle="Zwei Pläne über ihren jeweiligen Nutzungszeitraum"
        backTo="/analyse"
      />

      {plans.length < 2 ? (
        <EmptyState
          title="Mindestens zwei Pläne nötig"
          description="Sobald du zwei Trainingspläne hast, kannst du ihre Kennzahlen hier nebeneinanderstellen."
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader title="Pläne" as="h2" />
            <div className="grid gap-3">
              <SelectField
                label="Plan A"
                value={aId}
                onChange={(event) => setPlanA(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Plan B"
                value={bId}
                onChange={(event) => setPlanB(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
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
              Bitte zwei verschiedene Pläne wählen.
            </p>
          ) : comparison ? (
            <Card>
              {comparison.uncertain ? (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-surface-2 p-2 text-sm text-muted">
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  Die Nutzungszeiträume dieser Pläne überlappen sich. Ein Unterschied
                  lässt sich deshalb nicht eindeutig einem Plan zuschreiben.
                </p>
              ) : null}
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
