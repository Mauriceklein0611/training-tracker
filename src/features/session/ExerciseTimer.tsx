import { useCallback, useEffect, useState } from 'react';
import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/Field';
import { useNow } from '@/hooks/useNow';
import {
  clearTimerState,
  createTimerState,
  elapsedSeconds,
  isCountdownFinished,
  isRunning,
  loadTimerState,
  pause,
  remainingSeconds,
  reset,
  saveTimerState,
  setCountdown,
  start,
  type ExerciseTimerState,
} from '@/services/exerciseTimer';
import { playRestFinishedSound, primeAudio, vibrate } from '@/services/sound';
import { parseNumberInput } from '@/services/validation';
import { formatDuration } from '@/utils/date';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

/**
 * Stopwatch / countdown for time-based exercises.
 *
 * Manual entry stays available — this only offers to fill the duration field,
 * it never takes it over.
 */
export function ExerciseTimer({
  setId,
  targetSeconds,
  onApply,
  soundEnabled,
  vibrationEnabled,
  showComplete = true,
}: {
  setId: string;
  /** Plan target, prefilled as the countdown duration. */
  targetSeconds?: number;
  /** Hands the measured seconds to the set draft. */
  onApply: (seconds: number, options: { complete: boolean }) => void;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /**
   * Whether the timer offers its own "apply and complete" action. Strength
   * time-based sets keep it as a one-tap finish; cardio hides it so the single
   * completion is the editor's "Abschnitt abschließen" (A7 — no double completion).
   */
  showComplete?: boolean;
}) {
  const { t } = useTranslation('session');
  // Restore a running measurement after an accidental reload.
  const [state, setState] = useState<ExerciseTimerState>(
    () => loadTimerState(setId) ?? createTimerState(setId, targetSeconds ?? null),
  );
  const [countdownInput, setCountdownInput] = useState(() =>
    String(state.countdownSeconds ?? targetSeconds ?? ''),
  );
  const [notified, setNotified] = useState(false);

  const running = isRunning(state);
  const now = useNow(500, running);
  const seconds = elapsedSeconds(state, now.getTime());
  const remaining = remainingSeconds(state, now.getTime());
  const finished = isCountdownFinished(state, now.getTime());

  const apply = useCallback((next: ExerciseTimerState) => {
    setState(next);
    saveTimerState(next);
  }, []);

  // Persist across reloads, but only while there is something to restore.
  useEffect(() => {
    if (state.accumulatedMs === 0 && state.runningSince == null) clearTimerState();
  }, [state]);

  // Signal once when a countdown reaches zero.
  useEffect(() => {
    if (!finished || notified) return;
    setNotified(true);
    if (soundEnabled) playRestFinishedSound();
    if (vibrationEnabled) vibrate();
  }, [finished, notified, soundEnabled, vibrationEnabled]);

  const handleStart = () => {
    // Unlock audio from the tap so the countdown tone can play later on iOS.
    primeAudio();
    setNotified(false);
    apply(start(state));
  };

  const handleApply = (complete: boolean) => {
    const measured = elapsedSeconds(pause(state), Date.now());
    clearTimerState();
    setState(reset(createTimerState(setId, state.countdownSeconds)));
    onApply(measured, { complete });
  };

  const display = remaining != null && !finished ? remaining : seconds;

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        finished ? 'border-success/60 bg-surface' : 'border-border bg-surface',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {remaining != null
            ? finished
              ? t('timer.targetReached')
              : t('timer.countdown')
            : t('timer.stopwatch')}
        </span>
        {remaining != null ? (
          <span className="numeric text-xs text-muted">
            {t('timer.measured', { duration: formatDuration(seconds) })}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'numeric mt-1 text-4xl font-bold leading-none',
          finished && 'text-success rest-expired',
        )}
        aria-live="off"
      >
        {formatDuration(display)}
      </p>
      <p className="sr-only">
        {running
          ? t('timer.runningAnnouncement', { seconds })
          : t('timer.pausedAnnouncement', { seconds })}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {running ? (
          <Button variant="secondary" onClick={() => apply(pause(state))}>
            <Pause size={18} aria-hidden="true" />
            {t('timer.pause')}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleStart}>
            <Play size={18} aria-hidden="true" />
            {seconds > 0 ? t('timer.resume') : t('timer.start')}
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={seconds === 0 && !running}
          onClick={() => {
            setNotified(false);
            apply(reset(state));
          }}
        >
          <RotateCcw size={18} aria-hidden="true" />
          {t('timer.reset')}
        </Button>
      </div>

      {showComplete ? (
        <>
          <Button
            variant="success"
            fullWidth
            className="mt-2"
            disabled={seconds === 0}
            onClick={() => handleApply(true)}
          >
            <Check size={18} aria-hidden="true" />
            {t('timer.applyAndComplete')}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="mt-1"
            disabled={seconds === 0}
            onClick={() => handleApply(false)}
          >
            {t('timer.applyOnly')}
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          className="mt-2"
          disabled={seconds === 0}
          onClick={() => handleApply(false)}
        >
          <Check size={18} aria-hidden="true" />
          {t('timer.apply')}
        </Button>
      )}

      <div className="mt-3">
        <NumberField
          label={t('timer.countdownDuration')}
          value={countdownInput}
          disabled={running}
          onChange={(event) => {
            setCountdownInput(event.target.value);
            const parsed = parseNumberInput(event.target.value);
            const next =
              parsed == null || Number.isNaN(parsed) || parsed <= 0
                ? null
                : Math.round(parsed);
            setNotified(false);
            apply(setCountdown(state, next));
          }}
        />
      </div>
    </div>
  );
}
