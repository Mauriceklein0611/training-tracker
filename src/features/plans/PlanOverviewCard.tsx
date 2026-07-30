import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import { db } from '@/db/db';
import { Button } from '@/components/ui/Button';
import {
  activatePlan,
  deactivatePlan,
  getActivePlanId,
} from '@/db/repositories/planUsage';
import { computePlanOverview } from '@/services/planMetrics';
import type { TrainingPlan, WorkoutSession } from '@/types';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/format';

/** Completed sessions attributed to this plan (by planId snapshot). */
async function completedSessionsOfPlan(planId: string): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions.where('status').equals('completed').toArray();
  return sessions.filter((session) => session.planId === planId);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2 text-center">
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

/**
 * Plan dashboard overview: activate/deactivate the plan and show a light summary
 * derived purely from completed sessions (Phase 3). No invented numbers.
 */
export function PlanOverviewCard({ plan }: { plan: TrainingPlan }) {
  const { t } = useTranslation('plans');
  const activePlanId = useLiveQuery(() => getActivePlanId(), [], undefined);
  const sessions = useLiveQuery(
    () => completedSessionsOfPlan(plan.id),
    [plan.id],
    undefined,
  );

  const isActive = activePlanId === plan.id;
  const overview = sessions
    ? computePlanOverview({
        sessions,
        weeklyTarget: plan.sessionsPerWeekTarget,
      })
    : undefined;

  const goalLabel = plan.goalType ? t(`goal.${plan.goalType}`) : undefined;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate text-sm font-semibold">
            {goalLabel ?? t('overview.title')}
            {plan.startDate
              ? ` · ${t('overview.since', { date: formatDate(plan.startDate) })}`
              : ''}
          </span>
        </div>
        <Button
          variant={isActive ? 'secondary' : 'primary'}
          size="sm"
          onClick={() =>
            void (isActive ? deactivatePlan() : activatePlan(plan.id, new Date()))
          }
        >
          {isActive ? (
            <>
              <CheckCircle2 size={16} aria-hidden="true" />
              {t('overview.active')}
            </>
          ) : (
            <>
              <Circle size={16} aria-hidden="true" />
              {t('overview.activate')}
            </>
          )}
        </Button>
      </div>

      {overview ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat
            label={t('overview.sessions')}
            value={formatNumber(overview.sessionCount)}
          />
          <Stat
            label={t('overview.thisWeek')}
            value={
              overview.weeklyTarget
                ? `${overview.sessionsThisWeek}/${overview.weeklyTarget}`
                : String(overview.sessionsThisWeek)
            }
          />
          <Stat
            label={t('overview.averageWeek')}
            value={
              overview.avgSessionsPerWeek != null
                ? formatNumber(overview.avgSessionsPerWeek, 1)
                : '–'
            }
          />
        </div>
      ) : null}

      {overview && overview.lastSessionAt ? (
        <p className="mt-2 text-xs text-muted">
          {t('overview.lastTraining', {
            date: formatDate(overview.lastSessionAt),
          })}
        </p>
      ) : overview ? (
        <p className="mt-2 text-xs text-muted">{t('overview.noTraining')}</p>
      ) : null}
    </div>
  );
}
