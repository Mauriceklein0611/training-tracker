import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  computeCurrentWeekExerciseProgress,
  computeWeekProgress,
  goalReached,
  type WeekProgress,
} from '@/services/calendar';
import type { WeeklyGoals } from '@/types';
import { formatWeekRange } from '@/utils/date';
import { formatSets } from '@/utils/format';

const WEEKS_SHOWN = 4;

/** A single goal line with an encouraging progress bar. */
function GoalProgress({
  label,
  actual,
  goal,
  isCurrentWeek,
}: {
  label: string;
  actual: number;
  goal: number;
  isCurrentWeek: boolean;
}) {
  const reached = goalReached(actual, goal);
  const ratio = goal > 0 ? Math.min(1, actual / goal) : 0;
  const remaining = Math.max(0, goal - actual);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="numeric shrink-0 text-muted">
          {actual} / {goal}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={actual}
        aria-label={`${label}: ${actual} von ${goal}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            backgroundColor: reached ? 'var(--success)' : 'var(--accent)',
          }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {reached ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Check size={13} aria-hidden="true" /> Ziel erreicht
          </span>
        ) : isCurrentWeek ? (
          `Noch ${remaining} bis zum Wochenziel`
        ) : (
          `${actual} von ${goal} in dieser Woche`
        )}
      </p>
    </div>
  );
}

/**
 * Weekly goal overview.
 *
 * Goals are always optional and framed as encouragement: a week that stays
 * below target is shown as plain progress, never as a failure or a deficit. The
 * running week is clearly separated from finished weeks.
 */
export function WeeklyGoalsCard({
  dataset,
  goals,
  now = new Date(),
}: {
  dataset: AnalyticsDataset;
  goals: WeeklyGoals;
  now?: Date;
}) {
  const weeks = useMemo(
    () => computeWeekProgress(dataset, WEEKS_SHOWN, now),
    [dataset, now],
  );
  const exerciseProgress = useMemo(
    () => computeCurrentWeekExerciseProgress(dataset, goals.exerciseGoals ?? [], now),
    [dataset, goals.exerciseGoals, now],
  );

  const current = weeks[weeks.length - 1] as WeekProgress;
  const finishedWeeks = weeks.slice(0, -1).reverse();
  const hasOverallGoal =
    goals.sessionsPerWeek != null ||
    goals.workingSetsPerWeek != null ||
    goals.cardioMinutesPerWeek != null ||
    goals.cardioDistancePerWeekMeters != null ||
    goals.cardioSessionsPerWeek != null;

  return (
    <Card>
      <CardHeader title="Wochenziele" subtitle="Diese Woche" as="h2" />

      <div className="grid gap-4">
        {hasOverallGoal ? (
          <div className="grid gap-3">
            {goals.sessionsPerWeek != null ? (
              <GoalProgress
                label="Trainingseinheiten"
                actual={current.sessions}
                goal={goals.sessionsPerWeek}
                isCurrentWeek
              />
            ) : null}
            {goals.workingSetsPerWeek != null ? (
              <GoalProgress
                label="Arbeitssätze"
                actual={current.workingSets}
                goal={goals.workingSetsPerWeek}
                isCurrentWeek
              />
            ) : null}
            {goals.cardioMinutesPerWeek != null ? (
              <GoalProgress
                label="Cardio-Minuten"
                actual={Math.round(current.cardioMinutes)}
                goal={goals.cardioMinutesPerWeek}
                isCurrentWeek
              />
            ) : null}
            {goals.cardioDistancePerWeekMeters != null ? (
              <GoalProgress
                label="Cardio-Distanz (km)"
                actual={Math.round(current.cardioDistanceMeters / 100) / 10}
                goal={Math.round(goals.cardioDistancePerWeekMeters / 100) / 10}
                isCurrentWeek
              />
            ) : null}
            {goals.cardioSessionsPerWeek != null ? (
              <GoalProgress
                label="Cardio-Einheiten"
                actual={current.cardioSessions}
                goal={goals.cardioSessionsPerWeek}
                isCurrentWeek
              />
            ) : null}
          </div>
        ) : null}

        {exerciseProgress.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Übungen diese Woche
            </h3>
            {exerciseProgress.map((entry) => {
              const goal = entry.goal;
              if (goal.sessionsPerWeek != null) {
                return (
                  <GoalProgress
                    key={`${goal.exerciseId}-sessions`}
                    label={`${goal.exerciseNameSnapshot} · Einheiten`}
                    actual={entry.sessions}
                    goal={goal.sessionsPerWeek}
                    isCurrentWeek
                  />
                );
              }
              if (goal.workingSetsPerWeek != null) {
                return (
                  <GoalProgress
                    key={`${goal.exerciseId}-sets`}
                    label={`${goal.exerciseNameSnapshot} · Sätze`}
                    actual={entry.workingSets}
                    goal={goal.workingSetsPerWeek}
                    isCurrentWeek
                  />
                );
              }
              return null;
            })}
          </div>
        ) : null}

        {hasOverallGoal && finishedWeeks.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Abgeschlossene Wochen
            </h3>
            <ul className="grid gap-1.5">
              {finishedWeeks.map((week) => {
                const sessionsReached = goalReached(week.sessions, goals.sessionsPerWeek);
                const setsReached = goalReached(
                  week.workingSets,
                  goals.workingSetsPerWeek,
                );
                const allReached =
                  (goals.sessionsPerWeek == null || sessionsReached) &&
                  (goals.workingSetsPerWeek == null || setsReached);
                return (
                  <li
                    key={week.weekStart}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="text-muted">{formatWeekRange(week.weekStart)}</span>
                    <span className="numeric flex items-center gap-2">
                      {goals.sessionsPerWeek != null ? (
                        <span>{week.sessions} Einh.</span>
                      ) : null}
                      {goals.workingSetsPerWeek != null ? (
                        <span>{formatSets(week.workingSets)}</span>
                      ) : null}
                      {allReached ? (
                        <Check
                          size={15}
                          className="text-success"
                          aria-label="Ziel erreicht"
                        />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
