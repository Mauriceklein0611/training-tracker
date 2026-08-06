import { useId, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Link2,
  Link2Off,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/Button';
import {
  attachTemplateExerciseToPrevious,
  detachTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { ExerciseTargetFields } from '@/features/templates/ExerciseTargetFields';
import { useTargetSummaryLabels } from '@/features/templates/useTargetSummaryLabels';
import { summarizeExerciseTargets } from '@/features/templates/targetSummary';
import type { Exercise, TemplateExercise } from '@/types';
import { trackingTypeLabel } from '@/utils/format';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

/**
 * One exercise row inside the template editor. Kept as its own component so the
 * grouped and standalone layouts can share the exact same field editing.
 *
 * The row starts collapsed (#44): a plan day is read far more often than it is
 * edited, so it opens as a scannable list of exercises with their targets, and
 * the fields appear on tap. Reordering and removing stay reachable without
 * expanding anything.
 */
export function TemplateExerciseRow({
  entry,
  exercise,
  label,
  globalIndex,
  total,
  grouped,
  canGroupWithPrevious,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  entry: TemplateExercise;
  exercise?: Exercise;
  /** "A1"/"B" style position label. */
  label: string;
  globalIndex: number;
  total: number;
  grouped: boolean;
  canGroupWithPrevious: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
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
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="rounded-2xl border border-border bg-surface p-3"
    >
      <div className="flex items-start gap-2">
        <GripVertical
          size={20}
          className="mt-1 hidden shrink-0 cursor-grab text-muted sm:block"
          aria-hidden="true"
        />
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
            onClick={() => void moveTemplateExercise(entry.id, -1)}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('exercise.moveDown', { name })}
            disabled={globalIndex === total - 1}
            onClick={() => void moveTemplateExercise(entry.id, 1)}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('exercise.remove', { name })}
            onClick={() => void removeTemplateExercise(entry.id)}
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div id={detailsId} hidden={!expanded}>
        {/* Group link control: join the exercise above, or leave the current group. */}
        {grouped ? (
          <button
            type="button"
            onClick={() => void detachTemplateExercise(entry.id)}
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
          >
            <Link2Off size={16} aria-hidden="true" />
            {t('exercise.detachGroup')}
          </button>
        ) : canGroupWithPrevious ? (
          <button
            type="button"
            onClick={() => void attachTemplateExerciseToPrevious(entry.id)}
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
          >
            <Link2 size={16} aria-hidden="true" />
            {t('exercise.attachPrevious')}
          </button>
        ) : null}

        <ExerciseTargetFields
          trackingType={exercise?.trackingType ?? 'weight_reps'}
          values={entry}
          onChange={(patch) => void updateTemplateExercise(entry.id, patch)}
        />
      </div>
    </div>
  );
}
