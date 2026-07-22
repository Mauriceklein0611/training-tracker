import { X } from 'lucide-react';
import { isKnownMuscleGroup } from '@/constants/muscleGroups';
import { cn } from '@/utils/cn';

/**
 * Renders selected muscle groups as chips. The primary group is highlighted; a
 * value that is not in the catalog (a legacy or imported custom value) is still
 * shown and marked, never hidden. Removal is offered via a labelled button, so
 * the action is never carried by colour alone.
 */
export function MuscleGroupChips({
  primary,
  secondary,
  onRemovePrimary,
  onRemoveSecondary,
}: {
  primary?: string;
  secondary: string[];
  onRemovePrimary?: () => void;
  onRemoveSecondary?: (label: string) => void;
}) {
  const hasAny = Boolean(primary) || secondary.length > 0;
  if (!hasAny) {
    return <p className="text-sm text-muted">Noch keine Muskelgruppe gewählt.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {primary ? (
        <Chip
          label={primary}
          tone="primary"
          custom={!isKnownMuscleGroup(primary)}
          onRemove={onRemovePrimary}
        />
      ) : null}
      {secondary.map((label) => (
        <Chip
          key={label}
          label={label}
          tone="secondary"
          custom={!isKnownMuscleGroup(label)}
          onRemove={onRemoveSecondary ? () => onRemoveSecondary(label) : undefined}
        />
      ))}
    </ul>
  );
}

function Chip({
  label,
  tone,
  custom,
  onRemove,
}: {
  label: string;
  tone: 'primary' | 'secondary';
  custom: boolean;
  onRemove?: () => void;
}) {
  return (
    <li
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border py-1 pl-3 text-sm',
        onRemove ? 'pr-1' : 'pr-3',
        tone === 'primary'
          ? 'border-accent/50 bg-accent/15 font-medium text-text'
          : 'border-border bg-surface-2 text-muted',
      )}
    >
      <span className="min-w-0 truncate">
        {label}
        {custom ? <span className="ml-1 text-xs text-warning">(eigen)</span> : null}
      </span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`${label} entfernen`}
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-3"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}
