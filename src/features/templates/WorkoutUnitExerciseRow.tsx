import { ArrowDown, ArrowUp, Link2, Link2Off, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { NumberField, TextField } from '@/components/ui/Field';
import {
  attachWorkoutUnitExerciseToPrevious,
  detachWorkoutUnitExercise,
  moveWorkoutUnitExercise,
  removeWorkoutUnitExercise,
  updateWorkoutUnitExercise,
} from '@/db/repositories/workoutUnits';
import { parseNumberInput } from '@/services/validation';
import type { Exercise, WorkoutUnitTemplateExercise } from '@/types';
import { TRACKING_TYPE_LABELS } from '@/utils/format';

/**
 * One exercise row inside the library unit editor. Mirrors
 * {@link TemplateExerciseRow} but writes to the workout-unit repository, so a
 * library unit is edited with the exact same fields and grouping controls as a
 * plan day.
 */
export function WorkoutUnitExerciseRow({
  entry,
  exercise,
  label,
  globalIndex,
  total,
  grouped,
  canGroupWithPrevious,
}: {
  entry: WorkoutUnitTemplateExercise;
  exercise?: Exercise;
  label: string;
  globalIndex: number;
  total: number;
  grouped: boolean;
  canGroupWithPrevious: boolean;
}) {
  const isDuration = exercise?.trackingType === 'duration';
  const name = exercise?.name ?? 'Gelöschte Übung';

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            <span className="text-muted">{label} </span>
            {name}
          </p>
          <p className="text-xs text-muted">
            {exercise
              ? TRACKING_TYPE_LABELS[exercise.trackingType]
              : 'Diese Übung existiert nicht mehr.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            label={`${name} nach oben`}
            disabled={globalIndex === 0}
            onClick={() => void moveWorkoutUnitExercise(entry.id, -1)}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${name} nach unten`}
            disabled={globalIndex === total - 1}
            onClick={() => void moveWorkoutUnitExercise(entry.id, 1)}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${name} entfernen`}
            onClick={() => void removeWorkoutUnitExercise(entry.id)}
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {grouped ? (
        <button
          type="button"
          onClick={() => void detachWorkoutUnitExercise(entry.id)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Link2Off size={16} aria-hidden="true" />
          Aus Gruppe lösen
        </button>
      ) : canGroupWithPrevious ? (
        <button
          type="button"
          onClick={() => void attachWorkoutUnitExerciseToPrevious(entry.id)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Link2 size={16} aria-hidden="true" />
          Mit Übung darüber gruppieren
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField
          label="Sätze"
          value={String(entry.targetSets)}
          onChange={(event) =>
            void updateWorkoutUnitExercise(entry.id, {
              targetSets: Math.max(
                1,
                Math.round(parseNumberInput(event.target.value) ?? 1),
              ),
            })
          }
        />
        <NumberField
          label="Pause (s)"
          value={String(entry.restSeconds)}
          onChange={(event) =>
            void updateWorkoutUnitExercise(entry.id, {
              restSeconds: Math.max(
                0,
                Math.round(parseNumberInput(event.target.value) ?? 0),
              ),
            })
          }
        />
        {isDuration ? (
          <NumberField
            label="Zieldauer (s)"
            containerClassName="col-span-2"
            value={String(entry.targetDurationSeconds ?? '')}
            onChange={(event) =>
              void updateWorkoutUnitExercise(entry.id, {
                targetDurationSeconds:
                  parseNumberInput(event.target.value) == null
                    ? undefined
                    : Math.max(0, Math.round(parseNumberInput(event.target.value) ?? 0)),
              })
            }
          />
        ) : (
          <>
            <NumberField
              label="Wdh. von"
              value={String(entry.targetRepMin ?? '')}
              onChange={(event) =>
                void updateWorkoutUnitExercise(entry.id, {
                  targetRepMin:
                    parseNumberInput(event.target.value) == null
                      ? undefined
                      : Math.max(
                          0,
                          Math.round(parseNumberInput(event.target.value) ?? 0),
                        ),
                })
              }
            />
            <NumberField
              label="Wdh. bis"
              value={String(entry.targetRepMax ?? '')}
              onChange={(event) =>
                void updateWorkoutUnitExercise(entry.id, {
                  targetRepMax:
                    parseNumberInput(event.target.value) == null
                      ? undefined
                      : Math.max(
                          0,
                          Math.round(parseNumberInput(event.target.value) ?? 0),
                        ),
                })
              }
            />
          </>
        )}
        <TextField
          label="Notiz"
          containerClassName="col-span-2"
          value={entry.notes}
          placeholder="Optional"
          onChange={(event) =>
            void updateWorkoutUnitExercise(entry.id, { notes: event.target.value })
          }
        />
      </div>
    </div>
  );
}
