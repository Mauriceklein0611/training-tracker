import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { db } from '@/db/db';
import { parseNumberInput } from '@/services/validation';
import type { ExerciseWeeklyGoal, WeeklyGoals } from '@/types';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

/** Clamp helper: empty / invalid input clears the goal (undefined). */
function toGoalValue(raw: string, max: number): number | undefined {
  const value = parseNumberInput(raw);
  if (value == null || Number.isNaN(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < 1) return undefined;
  return Math.min(max, rounded);
}

type ExerciseMetric = 'sessions' | 'sets';

/**
 * Editor for the optional weekly goals.
 *
 * Goals are stored on the settings singleton. Leaving every field empty simply
 * means "no goals", so nothing here is ever required.
 */
export function WeeklyGoalsEditor({
  goals,
  onChange,
}: {
  goals: WeeklyGoals | undefined;
  onChange: (goals: WeeklyGoals) => void;
}) {
  const { t, i18n } = useTranslation('more');
  const exercises = useLiveQuery(
    () => db.exercises.filter((exercise) => !exercise.archived).toArray(),
    [],
    [],
  );

  const current: WeeklyGoals = goals ?? {};
  const exerciseGoals = useMemo(
    () => current.exerciseGoals ?? [],
    [current.exerciseGoals],
  );
  const [addId, setAddId] = useState('');
  const exercisesById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );

  const available = useMemo(() => {
    const taken = new Set(exerciseGoals.map((goal) => goal.exerciseId));
    return [...exercises]
      .filter((exercise) => !taken.has(exercise.id))
      .sort((a, b) =>
        exerciseDisplayName(a).localeCompare(
          exerciseDisplayName(b),
          i18n.resolvedLanguage,
        ),
      );
  }, [exercises, exerciseGoals, i18n.resolvedLanguage]);

  const update = (changes: Partial<WeeklyGoals>) => {
    onChange({ ...current, ...changes });
  };

  const updateExerciseGoal = (exerciseId: string, next: Partial<ExerciseWeeklyGoal>) => {
    update({
      exerciseGoals: exerciseGoals.map((goal) =>
        goal.exerciseId === exerciseId ? { ...goal, ...next } : goal,
      ),
    });
  };

  const removeExerciseGoal = (exerciseId: string) => {
    update({
      exerciseGoals: exerciseGoals.filter((goal) => goal.exerciseId !== exerciseId),
    });
  };

  const addExerciseGoal = () => {
    const exercise = exercises.find((item) => item.id === addId);
    if (!exercise) return;
    update({
      exerciseGoals: [
        ...exerciseGoals,
        {
          exerciseId: exercise.id,
          exerciseNameSnapshot: exercise.name,
          workingSetsPerWeek: 6,
        },
      ],
    });
    setAddId('');
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted">
        {t('screens.weeklyGoals.intro')}
      </p>

      <NumberField
        label={t('screens.weeklyGoals.sessions')}
        value={current.sessionsPerWeek != null ? String(current.sessionsPerWeek) : ''}
        placeholder={t('screens.weeklyGoals.noGoal')}
        onChange={(event) =>
          update({ sessionsPerWeek: toGoalValue(event.target.value, 14) })
        }
      />
      <NumberField
        label={t('screens.weeklyGoals.workingSets')}
        hint={t('screens.weeklyGoals.workingSetsHint')}
        value={
          current.workingSetsPerWeek != null ? String(current.workingSetsPerWeek) : ''
        }
        placeholder={t('screens.weeklyGoals.noGoal')}
        onChange={(event) =>
          update({ workingSetsPerWeek: toGoalValue(event.target.value, 500) })
        }
      />
      <NumberField
        label={t('screens.weeklyGoals.cardioMinutes')}
        value={
          current.cardioMinutesPerWeek != null ? String(current.cardioMinutesPerWeek) : ''
        }
        placeholder={t('screens.weeklyGoals.noGoal')}
        onChange={(event) =>
          update({ cardioMinutesPerWeek: toGoalValue(event.target.value, 10000) })
        }
      />
      <NumberField
        label={t('screens.weeklyGoals.cardioDistance')}
        decimal
        value={
          current.cardioDistancePerWeekMeters != null
            ? String(current.cardioDistancePerWeekMeters / 1000)
            : ''
        }
        placeholder={t('screens.weeklyGoals.noGoal')}
        onChange={(event) => {
          const km = parseNumberInput(event.target.value);
          update({
            cardioDistancePerWeekMeters:
              km == null || !Number.isFinite(km) || km <= 0
                ? undefined
                : Math.round(km * 1000),
          });
        }}
      />
      <NumberField
        label={t('screens.weeklyGoals.cardioSessions')}
        value={
          current.cardioSessionsPerWeek != null
            ? String(current.cardioSessionsPerWeek)
            : ''
        }
        placeholder={t('screens.weeklyGoals.noGoal')}
        onChange={(event) =>
          update({ cardioSessionsPerWeek: toGoalValue(event.target.value, 14) })
        }
      />

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">
          {t('screens.weeklyGoals.exerciseGoals')}
        </h3>

        {exerciseGoals.length === 0 ? (
          <p className="text-xs text-muted">{t('screens.weeklyGoals.noExerciseGoals')}</p>
        ) : (
          <ul className="grid gap-3">
            {exerciseGoals.map((goal) => {
              const metric: ExerciseMetric =
                goal.sessionsPerWeek != null ? 'sessions' : 'sets';
              const value =
                metric === 'sessions' ? goal.sessionsPerWeek : goal.workingSetsPerWeek;
              const currentExercise = exercisesById.get(goal.exerciseId);
              const displayName = currentExercise
                ? exerciseDisplayName(currentExercise)
                : goal.exerciseNameSnapshot;
              return (
                <li
                  key={goal.exerciseId}
                  className="grid gap-2 rounded-xl border border-border bg-surface-2 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <IconButton
                      label={t('screens.weeklyGoals.removeExerciseGoal', {
                        name: displayName,
                      })}
                      variant="ghost"
                      onClick={() => removeExerciseGoal(goal.exerciseId)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField
                      label={t('screens.weeklyGoals.goal')}
                      value={metric}
                      onChange={(event) => {
                        const nextMetric = event.target.value as ExerciseMetric;
                        updateExerciseGoal(goal.exerciseId, {
                          sessionsPerWeek:
                            nextMetric === 'sessions' ? (value ?? 2) : undefined,
                          workingSetsPerWeek:
                            nextMetric === 'sets' ? (value ?? 6) : undefined,
                        });
                      }}
                    >
                      <option value="sessions">
                        {t('screens.weeklyGoals.sessionsPerWeek')}
                      </option>
                      <option value="sets">{t('screens.weeklyGoals.setsPerWeek')}</option>
                    </SelectField>
                    <NumberField
                      label={t('screens.weeklyGoals.amount')}
                      value={value != null ? String(value) : ''}
                      onChange={(event) => {
                        const parsed = toGoalValue(
                          event.target.value,
                          metric === 'sessions' ? 14 : 200,
                        );
                        updateExerciseGoal(goal.exerciseId, {
                          sessionsPerWeek: metric === 'sessions' ? parsed : undefined,
                          workingSetsPerWeek: metric === 'sets' ? parsed : undefined,
                        });
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {available.length > 0 ? (
          <div className="flex items-end gap-2">
            <SelectField
              label={t('screens.weeklyGoals.addExercise')}
              containerClassName="flex-1"
              value={addId}
              onChange={(event) => setAddId(event.target.value)}
            >
              <option value="">{t('screens.weeklyGoals.chooseExercise')}</option>
              {available.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exerciseDisplayName(exercise)}
                </option>
              ))}
            </SelectField>
            <Button variant="secondary" onClick={addExerciseGoal} disabled={!addId}>
              <Plus size={18} aria-hidden="true" />
              {t('screens.weeklyGoals.goal')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
