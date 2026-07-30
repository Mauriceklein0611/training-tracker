import { ArrowDown, ArrowUp, Link2, Link2Off, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/Button';
import {
  attachWorkoutUnitExerciseToPrevious,
  detachWorkoutUnitExercise,
  moveWorkoutUnitExercise,
  removeWorkoutUnitExercise,
  updateWorkoutUnitExercise,
} from '@/db/repositories/workoutUnits';
import { ExerciseTargetFields } from '@/features/templates/ExerciseTargetFields';
import type { Exercise, WorkoutUnitTemplateExercise } from '@/types';
import { trackingTypeLabel } from '@/utils/format';

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
  const { t } = useTranslation('library');
  const name = exercise?.name ?? t('exercise.deleted');

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            <span className="text-muted">{label} </span>
            {name}
          </p>
          <p className="text-xs text-muted">
            {exercise ? trackingTypeLabel(exercise.trackingType) : t('exercise.missing')}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            label={t('exercise.moveUp', { name })}
            disabled={globalIndex === 0}
            onClick={() => void moveWorkoutUnitExercise(entry.id, -1)}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('exercise.moveDown', { name })}
            disabled={globalIndex === total - 1}
            onClick={() => void moveWorkoutUnitExercise(entry.id, 1)}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('exercise.remove', { name })}
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
          {t('exercise.detachGroup')}
        </button>
      ) : canGroupWithPrevious ? (
        <button
          type="button"
          onClick={() => void attachWorkoutUnitExerciseToPrevious(entry.id)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Link2 size={16} aria-hidden="true" />
          {t('exercise.attachPrevious')}
        </button>
      ) : null}

      <ExerciseTargetFields
        trackingType={exercise?.trackingType ?? 'weight_reps'}
        values={entry}
        onChange={(patch) => void updateWorkoutUnitExercise(entry.id, patch)}
      />
    </div>
  );
}
