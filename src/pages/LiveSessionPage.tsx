import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Flame, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import {
  addExerciseToSession,
  adjustRestTarget,
  deleteSession,
  endRest,
  finishSession,
  getSessionDetail,
  type SessionDetail,
  updateSession,
} from '@/db/repositories/sessions';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { RestTimerBar } from '@/features/session/RestTimerBar';
import { LiveExerciseList } from '@/features/session/LiveExerciseList';
import { PostCheckInCard, PreCheckInCard } from '@/features/checkin/CheckInCards';
import { SessionSummaryView } from '@/features/session/SessionSummaryView';
import { useActiveRest } from '@/features/session/useActiveRest';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { resolveBodyWeightKg } from '@/services/calories';
import { loadAnalyticsDataset } from '@/services/dataset';
import { summarizeSession } from '@/services/sessionSummary';
import { workoutProgress } from '@/services/sessionProgress';
import { isCardio } from '@/services/metrics';
import { formatDuration } from '@/utils/date';
import { formatSections, formatSets } from '@/utils/format';

/** Isolates the one-second workout clock from the exercise-list render tree. */
function WorkoutElapsed({ startedAt, active }: { startedAt: string; active: boolean }) {
  const now = useNow(1000, active);
  const seconds = Math.max(0, (now.getTime() - new Date(startedAt).getTime()) / 1000);
  return <span>{formatDuration(seconds)}</span>;
}

/** Isolates rest ticks and notifications from the full live workout page. */
function StickyRestTimer({
  detail,
  hidden,
  soundEnabled,
  vibrationEnabled,
  voiceEnabled,
}: {
  detail: SessionDetail;
  hidden: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  voiceEnabled: boolean;
}) {
  const rest = useActiveRest(detail, {
    soundEnabled,
    vibrationEnabled,
    voiceEnabled,
  });
  if (!rest || hidden) return null;
  return (
    <RestTimerBar
      compact
      className="mt-2"
      rest={rest}
      onEndRest={() => void endRest(rest.set.id)}
      onAdjust={(delta) => void adjustRestTarget(rest.set.id, delta)}
    />
  );
}

/**
 * Live workout view.
 *
 * This is the screen used while standing in the gym, so the layout stays
 * vertical and large: no tables, no dense grids, and every control is at least
 * 44 px tall. Every change is written to IndexedDB immediately.
 */
export default function LiveSessionPage() {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation();
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();

  const detail = useLiveQuery(() => getSessionDetail(sessionId), [sessionId]);
  const templateTargets = useLiveQuery(async () => {
    if (!detail?.session.templateId) return new Map<string, never>();
    const rows = await db.templateExercises
      .where('templateId')
      .equals(detail.session.templateId)
      .toArray();
    return new Map(rows.map((row) => [row.exerciseId, row]));
  }, [detail?.session.templateId]);

  /*
   * Body weight for the calorie estimate: the entry valid on the day of this
   * workout, so an estimate never silently changes with a later weigh-in.
   */
  const bodyWeightKg = useLiveQuery(async () => {
    if (!detail) return null;
    const entries = await db.bodyWeightEntries.toArray();
    return resolveBodyWeightKg(entries, detail.session.startedAt);
  }, [detail?.session.startedAt]);

  const [pickerOpen, setPickerOpen] = useState(false);
  // Quick cardio entry (?add=cardio): open the picker filtered to cardio once,
  // then strip the param so a reload does not reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerCardioOnly, setPickerCardioOnly] = useState(false);
  useEffect(() => {
    if (searchParams.get('add') === 'cardio') {
      setPickerCardioOnly(true);
      setPickerOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /*
   * Session-exercises whose own rest bar is currently on screen. As long as one
   * is, the header does not repeat the timer — the running rest is shown in
   * exactly one place, and reappears up top as soon as it is scrolled away.
   */
  const [inlineRestIds, setInlineRestIds] = useState<string[]>([]);
  const handleRestVisibility = useCallback((id: string, visible: boolean) => {
    setInlineRestIds((current) => {
      if (visible) return current.includes(id) ? current : [...current, id];
      return current.includes(id) ? current.filter((entry) => entry !== id) : current;
    });
  }, []);

  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const isActive = detail?.session.status === 'active';

  // Progressive enhancement: keep the display on while training, released
  // automatically when the workout ends or the setting is switched off.
  useWakeLock(isActive && settings.keepScreenAwake);

  // The summary is only computed while the finish dialog is open.
  const summary = useLiveQuery(async () => {
    if (!finishOpen) return null;
    const dataset = await loadAnalyticsDataset();
    return summarizeSession(dataset, sessionId);
  }, [finishOpen, sessionId]);

  const completedSetCount = useMemo(
    () =>
      detail?.exercises.reduce(
        (sum, entry) => sum + entry.sets.filter((set) => set.completedAt).length,
        0,
      ) ?? 0,
    [detail],
  );

  // A pure cardio session must never read in strength terms ("0 Sätze"): its
  // headline and discard warning are derived from cardio sections instead.
  // Kind is taken from the exercises present, so an empty run still says
  // "Abschnitte" before the first section is completed; anything with a
  // strength exercise stays on "Sätze" (matching the history list).
  const isCardioOnly = useMemo(() => {
    const exercises = detail?.exercises ?? [];
    if (exercises.length === 0) return false;
    return exercises.every(
      (entry) => entry.sessionExercise.trackingTypeSnapshot === 'cardio',
    );
  }, [detail]);

  const completedSectionCount = useMemo(
    () =>
      detail?.exercises.reduce(
        (sum, entry) =>
          sum +
          entry.sets.filter(
            (set) => set.completedAt && isCardio(set, entry.sessionExercise),
          ).length,
        0,
      ) ?? 0,
    [detail],
  );

  const progress = useMemo(
    () =>
      workoutProgress(
        (detail?.exercises ?? []).map((entry) => ({
          targetSets: entry.sessionExercise.targetSetsSnapshot,
          finishedAt: entry.sessionExercise.finishedAt,
          sets: entry.sets,
        })),
      ),
    [detail],
  );

  if (detail === undefined) {
    return (
      <p className="p-6 text-center text-sm text-muted" role="status">
        {t('live.loading')}
      </p>
    );
  }

  if (!detail) {
    return (
      <div className="pt-6">
        <EmptyState
          title={t('live.notFound')}
          description={t('live.notFoundDescription')}
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              {t('live.home')}
            </Button>
          }
        />
      </div>
    );
  }

  const handleFinish = async () => {
    await finishSession(sessionId);
    setFinishOpen(false);
    toast.show(t('live.finished'), 'success');
    navigate(`/verlauf/${sessionId}`, { replace: true });
  };

  const handleDiscard = async () => {
    await deleteSession(sessionId);
    setDiscardOpen(false);
    toast.show(t('live.discarded'), 'info');
    navigate('/', { replace: true });
  };

  return (
    <>
      {/*
       * Reduced header: during a workout the app deliberately hides the main
       * navigation. The rest timer lives *inside* this header, so the running
       * rest stays visible while scrolling through the exercises and can never
       * be overlapped by a second sticky element (#44).
       */}
      <header className="app-sticky-header header-safe sticky top-0 z-30 -mx-4 mb-3 border-b border-border bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">
              {detail.session.name}
            </h1>
            <p className="numeric text-sm text-muted">
              <WorkoutElapsed startedAt={detail.session.startedAt} active={isActive} /> ·{' '}
              {isCardioOnly
                ? formatSections(completedSectionCount)
                : formatSets(completedSetCount)}
              {progress.totalExercises > 0
                ? ` · ${t('live.exerciseProgress', {
                    current: Math.min(
                      progress.doneExercises + 1,
                      progress.totalExercises,
                    ),
                    total: progress.totalExercises,
                  })}`
                : ''}
            </p>
            {progress.totalExercises > 0 ? (
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.totalExercises}
                aria-valuenow={progress.doneExercises}
                aria-label={t('live.progressAria')}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{
                    width: `${(progress.doneExercises / progress.totalExercises) * 100}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
          <IconButton
            label={t('live.discard')}
            onClick={() => setDiscardOpen(true)}
            className="shrink-0"
          >
            <X size={22} aria-hidden="true" />
          </IconButton>
          <Button variant="success" size="sm" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 size={18} aria-hidden="true" />
            {t('live.finishShort')}
          </Button>
        </div>

        <StickyRestTimer
          detail={detail}
          hidden={inlineRestIds.length > 0}
          soundEnabled={settings.restSoundEnabled}
          vibrationEnabled={settings.restVibrationEnabled}
          voiceEnabled={settings.voiceAnnouncementsEnabled}
        />
      </header>

      <div className="mb-3">
        <PreCheckInCard sessionId={sessionId} value={detail.session.preCheckIn} />
      </div>

      {/*
       * Without a body weight there is no calorie estimate. Saying so once —
       * with the way to fix it — beats leaving the figure silently absent (#46).
       */}
      {bodyWeightKg === null && detail.exercises.length > 0 ? (
        <Link
          to="/mehr/profil"
          className="mb-3 flex min-h-[44px] items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-muted"
        >
          <Flame size={16} className="shrink-0 text-accent" aria-hidden="true" />
          <span>
            {t('live.caloriesUnavailable')}{' '}
            <span className="font-medium text-accent">{t('live.caloriesAction')}</span>
          </span>
        </Link>
      ) : null}

      {detail.exercises.length === 0 ? (
        <EmptyState
          title={t('live.emptyTitle')}
          description={t('live.emptyDescription')}
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              {t('live.addExercise')}
            </Button>
          }
        />
      ) : (
        <LiveExerciseList
          detail={detail}
          sessionId={sessionId}
          targets={templateTargets}
          soundEnabled={settings.restSoundEnabled}
          vibrationEnabled={settings.restVibrationEnabled}
          effortInput={settings.effortInput ?? 'rir'}
          expertLabels={settings.explainMode === 'expert'}
          bodyWeightKg={bodyWeightKg}
          onRestVisibilityChange={handleRestVisibility}
        />
      )}

      {detail.exercises.length > 0 ? (
        <Button
          variant="secondary"
          fullWidth
          className="mt-3"
          onClick={() => setPickerOpen(true)}
        >
          <Plus size={18} aria-hidden="true" />
          {t('live.addExercise')}
        </Button>
      ) : null}

      <div className="mt-4">
        <TextAreaField
          label={t('live.note')}
          value={notes ?? detail.session.notes}
          placeholder={t('live.notePlaceholder')}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes != null) void updateSession(sessionId, { notes });
          }}
        />
      </div>

      <div className="mt-4">
        <PostCheckInCard sessionId={sessionId} value={detail.session.postCheckIn} />
      </div>

      <Button
        variant="success"
        size="lg"
        fullWidth
        className="mt-4"
        onClick={() => setFinishOpen(true)}
      >
        <CheckCircle2 size={20} aria-hidden="true" />
        {t('live.finish')}
      </Button>

      <ExercisePickerDialog
        open={pickerOpen}
        title={pickerCardioOnly ? t('live.chooseCardio') : t('live.addExercise')}
        trackingTypeFilter={pickerCardioOnly ? 'cardio' : undefined}
        onClose={() => {
          setPickerOpen(false);
          setPickerCardioOnly(false);
        }}
        onSelect={async (exercise) => {
          await addExerciseToSession(sessionId, exercise);
          setPickerOpen(false);
          setPickerCardioOnly(false);
        }}
      />

      {/* Finishing is always confirmed — an accidental tap must not end the workout. */}
      <Dialog
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={t('live.finishTitle')}
        description={
          isCardioOnly
            ? t('live.finishCardioDescription')
            : t('live.finishStrengthDescription')
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFinishOpen(false)}>
              {t('live.continue')}
            </Button>
            <Button variant="success" onClick={() => void handleFinish()}>
              {t('live.complete')}
            </Button>
          </>
        }
      >
        {summary ? (
          <SessionSummaryView summary={summary} />
        ) : (
          <p className="text-sm text-muted">{t('live.calculating')}</p>
        )}
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title={t('live.discardTitle')}
        description={
          completedSetCount > 0
            ? t('live.discardWithData', {
                value: isCardioOnly
                  ? formatSections(completedSectionCount)
                  : formatSets(completedSetCount),
              })
            : t('live.discardEmpty')
        }
        confirmLabel={t('live.discardForever')}
        cancelLabel={tCommon('action.cancel')}
        destructive
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => void handleDiscard()}
      >
        <Button variant="secondary" fullWidth onClick={() => setDiscardOpen(false)}>
          <Trash2 size={18} aria-hidden="true" />
          {t('live.keep')}
        </Button>
      </ConfirmDialog>
    </>
  );
}
