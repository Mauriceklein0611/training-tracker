import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { db } from '@/db/db';
import { parseNumberInput } from '@/services/validation';
import type { ExerciseWeeklyGoal, WeeklyGoals } from '@/types';

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
  const exercises = useLiveQuery(
    () => db.exercises.filter((exercise) => !exercise.archived).toArray(),
    [],
    [],
  );

  const current: WeeklyGoals = goals ?? {};
  const exerciseGoals = useMemo(() => current.exerciseGoals ?? [], [current.exerciseGoals]);
  const [addId, setAddId] = useState('');

  const available = useMemo(() => {
    const taken = new Set(exerciseGoals.map((goal) => goal.exerciseId));
    return [...exercises]
      .filter((exercise) => !taken.has(exercise.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [exercises, exerciseGoals]);

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
    update({ exerciseGoals: exerciseGoals.filter((goal) => goal.exerciseId !== exerciseId) });
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
        Ziele sind freiwillig und helfen nur beim Dranbleiben. Leere Felder bedeuten „kein Ziel“.
      </p>

      <NumberField
        label="Trainingseinheiten pro Woche"
        value={current.sessionsPerWeek != null ? String(current.sessionsPerWeek) : ''}
        placeholder="kein Ziel"
        onChange={(event) => update({ sessionsPerWeek: toGoalValue(event.target.value, 14) })}
      />
      <NumberField
        label="Arbeitssätze pro Woche"
        value={current.workingSetsPerWeek != null ? String(current.workingSetsPerWeek) : ''}
        placeholder="kein Ziel"
        onChange={(event) => update({ workingSetsPerWeek: toGoalValue(event.target.value, 500) })}
      />

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">Übungsziele (optional)</h3>

        {exerciseGoals.length === 0 ? (
          <p className="text-xs text-muted">
            Noch keine übungsspezifischen Ziele. Du kannst z. B. „Kniebeugen 2× pro Woche“ festlegen.
          </p>
        ) : (
          <ul className="grid gap-3">
            {exerciseGoals.map((goal) => {
              const metric: ExerciseMetric =
                goal.sessionsPerWeek != null ? 'sessions' : 'sets';
              const value = metric === 'sessions' ? goal.sessionsPerWeek : goal.workingSetsPerWeek;
              return (
                <li
                  key={goal.exerciseId}
                  className="grid gap-2 rounded-xl border border-border bg-surface-2 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {goal.exerciseNameSnapshot}
                    </span>
                    <IconButton
                      label={`Ziel für ${goal.exerciseNameSnapshot} entfernen`}
                      variant="ghost"
                      onClick={() => removeExerciseGoal(goal.exerciseId)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField
                      label="Ziel"
                      value={metric}
                      onChange={(event) => {
                        const nextMetric = event.target.value as ExerciseMetric;
                        updateExerciseGoal(goal.exerciseId, {
                          sessionsPerWeek: nextMetric === 'sessions' ? (value ?? 2) : undefined,
                          workingSetsPerWeek: nextMetric === 'sets' ? (value ?? 6) : undefined,
                        });
                      }}
                    >
                      <option value="sessions">Einheiten/Woche</option>
                      <option value="sets">Sätze/Woche</option>
                    </SelectField>
                    <NumberField
                      label="Anzahl"
                      value={value != null ? String(value) : ''}
                      onChange={(event) => {
                        const parsed = toGoalValue(event.target.value, metric === 'sessions' ? 14 : 200);
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
              label="Übung hinzufügen"
              containerClassName="flex-1"
              value={addId}
              onChange={(event) => setAddId(event.target.value)}
            >
              <option value="">Übung wählen …</option>
              {available.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </SelectField>
            <Button variant="secondary" onClick={addExerciseGoal} disabled={!addId}>
              <Plus size={18} aria-hidden="true" />
              Ziel
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
