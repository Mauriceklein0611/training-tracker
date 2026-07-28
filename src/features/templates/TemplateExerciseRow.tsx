import { ArrowDown, ArrowUp, GripVertical, Link2, Link2Off, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import {
  attachTemplateExerciseToPrevious,
  detachTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { ExerciseTargetFields } from '@/features/templates/ExerciseTargetFields';
import type { Exercise, TemplateExercise } from '@/types';
import { TRACKING_TYPE_LABELS } from '@/utils/format';

/**
 * One exercise row inside the template editor. Kept as its own component so the
 * grouped and standalone layouts can share the exact same field editing.
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
  const name = exercise?.name ?? 'Gelöschte Übung';

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
            onClick={() => void moveTemplateExercise(entry.id, -1)}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${name} nach unten`}
            disabled={globalIndex === total - 1}
            onClick={() => void moveTemplateExercise(entry.id, 1)}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${name} entfernen`}
            onClick={() => void removeTemplateExercise(entry.id)}
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Group link control: join the exercise above, or leave the current group. */}
      {grouped ? (
        <button
          type="button"
          onClick={() => void detachTemplateExercise(entry.id)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Link2Off size={16} aria-hidden="true" />
          Aus Gruppe lösen
        </button>
      ) : canGroupWithPrevious ? (
        <button
          type="button"
          onClick={() => void attachTemplateExerciseToPrevious(entry.id)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Link2 size={16} aria-hidden="true" />
          Mit Übung darüber gruppieren
        </button>
      ) : null}

      <ExerciseTargetFields
        trackingType={exercise?.trackingType ?? 'weight_reps'}
        values={entry}
        onChange={(patch) => void updateTemplateExercise(entry.id, patch)}
      />
    </div>
  );
}
