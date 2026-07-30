import { Check, Minus, Plus, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ActiveRest } from '@/features/session/useActiveRest';
import { cn } from '@/utils/cn';
import { formatDuration } from '@/utils/date';
import { useTranslation } from 'react-i18next';

/**
 * Sticky rest countdown.
 *
 * Shows remaining time while counting down and switches to the elapsed
 * overtime once the target is reached, with a clear visual state change that
 * does not rely on colour alone (the label changes too).
 */
export function RestTimerBar({
  rest,
  onEndRest,
  onAdjust,
}: {
  rest: ActiveRest;
  onEndRest: () => void;
  /** Nudge the rest target by ±seconds (the +15 / −15 controls). */
  onAdjust: (deltaSeconds: number) => void;
}) {
  const { t } = useTranslation('session');
  const { progress } = rest;
  const reached = progress.targetReached;
  const ratio =
    progress.targetSeconds > 0
      ? Math.min(1, progress.elapsedSeconds / progress.targetSeconds)
      : 0;

  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-4 mb-3 border-b px-4 py-3 backdrop-blur',
        reached ? 'border-success/60 bg-surface' : 'border-border bg-surface/95',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Timer
          size={22}
          aria-hidden="true"
          className={cn(
            'shrink-0',
            reached ? 'text-success rest-expired' : 'text-accent',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {reached ? t('rest.reached') : t('rest.running')} · {rest.exerciseName}
          </p>
          <p
            className="numeric text-2xl font-bold leading-tight"
            // Announced politely so a screen reader does not read every second.
            aria-live="off"
          >
            {reached
              ? `+${formatDuration(progress.overtimeSeconds)}`
              : formatDuration(progress.remainingSeconds)}
            <span className="ml-2 text-sm font-normal text-muted">
              {t('rest.target', { duration: formatDuration(progress.targetSeconds) })}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="px-2"
            aria-label={t('rest.decrease')}
            onClick={() => onAdjust(-15)}
          >
            <Minus size={16} aria-hidden="true" />
            15
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="px-2"
            aria-label={t('rest.increase')}
            onClick={() => onAdjust(15)}
          >
            <Plus size={16} aria-hidden="true" />
            15
          </Button>
        </div>
        <Button
          variant={reached ? 'success' : 'secondary'}
          className="shrink-0"
          onClick={onEndRest}
        >
          <Check size={18} aria-hidden="true" />
          {t('rest.end')}
        </Button>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.targetSeconds}
        aria-valuenow={Math.min(progress.elapsedSeconds, progress.targetSeconds)}
        aria-label={t('rest.progress')}
      >
        <div
          className={cn('h-full rounded-full', reached ? 'bg-success' : 'bg-accent')}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <p className="sr-only">
        {reached
          ? t('rest.reachedAnnouncement', {
              target: progress.targetSeconds,
              elapsed: progress.elapsedSeconds,
            })
          : t('rest.remainingAnnouncement', { remaining: progress.remainingSeconds })}
      </p>
    </div>
  );
}
