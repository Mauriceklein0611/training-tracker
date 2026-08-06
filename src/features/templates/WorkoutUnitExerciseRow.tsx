import { useId, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Link2,
  Link2Off,
  Trash2,
} from 'lucide-react';
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
import { useTargetSummaryLabels } from '@/features/templates/useTargetSummaryLabels';
import { summarizeExerciseTargets } from '@/features/templates/targetSummary';
import type { Exercise, WorkoutUnitTemplateExercise } from '@/types';
import { trackingTypeLabel } from '@/utils/format';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

/**
 * One exercise row inside the library unit editor. Mirrors
 * {@link TemplateExerciseRow} but writes to the workout-unit repository, so a
 * library unit is edited with the exact same fields, grouping controls and
 * collapsed-by-default behaviour as a plan day (#44).
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
  const name = exercise ? exerciseDisplayName(exercise) : t('exercise.deleted');
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const summaryLabels = useTargetSummaryLabels();
  const summary = summarizeExerciseTargets(
    entry,
    exercise?.trackingType ?? 'weight_reps',
    summaryLabels,
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex min-h-[44px] min-w-0 flex-1 items-start gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown
              size={18}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              size={18}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              <span className="text-muted">{label} </span>
              {name}
            </span>
            <span className="block text-xs text-muted">
              {exercise
                ? trackingTypeLabel(exercise.trackingType)
                : t('exercise.missing')}
            </span>
            {expanded ? null : (
              <span className="numeric block text-xs text-muted">{summary}</span>
            )}
          </span>
        </button>
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

      <div id={detailsId} hidden={!expanded}>
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
    </div>
  );
}
