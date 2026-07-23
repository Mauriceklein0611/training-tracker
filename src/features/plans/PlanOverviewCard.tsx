import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import { db } from '@/db/db';
import { Button } from '@/components/ui/Button';
import {
  activatePlan,
  deactivatePlan,
  getActivePlanId,
} from '@/db/repositories/planUsage';
import { computePlanOverview } from '@/services/planMetrics';
import { PLAN_GOAL_TYPE_LABELS } from '@/services/planGoals';
import type { TrainingPlan, WorkoutSession } from '@/types';
import { dayKey } from '@/utils/date';

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

  const goalLabel = plan.goalType ? PLAN_GOAL_TYPE_LABELS[plan.goalType] : undefined;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate text-sm font-semibold">
            {goalLabel ? goalLabel : 'Übersicht'}
            {plan.startDate ? ` · seit ${plan.startDate}` : ''}
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
              Aktiver Plan
            </>
          ) : (
            <>
              <Circle size={16} aria-hidden="true" />
              Aktivieren
            </>
          )}
        </Button>
      </div>

      {overview ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Einheiten" value={String(overview.sessionCount)} />
          <Stat
            label="diese Woche"
            value={
              overview.weeklyTarget
                ? `${overview.sessionsThisWeek}/${overview.weeklyTarget}`
                : String(overview.sessionsThisWeek)
            }
          />
          <Stat
            label="Ø / Woche"
            value={
              overview.avgSessionsPerWeek != null
                ? overview.avgSessionsPerWeek.toLocaleString('de-DE')
                : '–'
            }
          />
        </div>
      ) : null}

      {overview && overview.lastSessionAt ? (
        <p className="mt-2 text-xs text-muted">
          Letztes Training: {dayKey(overview.lastSessionAt)}
        </p>
      ) : overview ? (
        <p className="mt-2 text-xs text-muted">Noch kein Training in diesem Plan.</p>
      ) : null}
    </div>
  );
}
