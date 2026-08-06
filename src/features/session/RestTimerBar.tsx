import { Check, Minus, Plus, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ActiveRest } from '@/features/session/useActiveRest';
import { cn } from '@/utils/cn';
import { formatDuration } from '@/utils/date';
import { useTranslation } from 'react-i18next';

/**
 * Rest countdown of the running workout.
 *
 * Shows remaining time while counting down and switches to the elapsed
 * overtime once the target is reached, with a clear visual state change that
 * does not rely on colour alone (the label changes too).
 *
 * The bar is deliberately *not* positioned itself: it is placed either directly
 * in the exercise (under the sets) or inside the sticky workout header, so a
 * second `sticky top-0` element can never overlap the title (#44). Its time
 * block and its controls sit on two rows, which keeps both readable on a narrow
 * phone and at large font sizes.
 */
export function RestTimerBar({
  rest,
  onEndRest,
  onAdjust,
  className,
}: {
  rest: ActiveRest;
  onEndRest: () => void;
  /** Nudge the rest target by ±seconds (the +15 / −15 controls). */
  onAdjust: (deltaSeconds: number) => void;
  className?: string;
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
        'rounded-xl border px-3 py-2',
        reached ? 'border-success/60 bg-surface' : 'border-border bg-surface-2/60',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Timer
          size={22}
          aria-hidden="true"
          className={cn(
            'shrink-0',
            reached ? 'text-success rest-expired' : 'text-accent',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
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
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 px-2"
          aria-label={t('rest.decrease')}
          onClick={() => onAdjust(-15)}
        >
          <Minus size={16} aria-hidden="true" />
          15
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 px-2"
          aria-label={t('rest.increase')}
          onClick={() => onAdjust(15)}
        >
          <Plus size={16} aria-hidden="true" />
          15
        </Button>
        <Button
          variant={reached ? 'success' : 'secondary'}
          size="sm"
          className="min-w-0 flex-1"
          onClick={onEndRest}
        >
          <Check size={18} aria-hidden="true" />
          <span className="truncate">{t('rest.end')}</span>
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
