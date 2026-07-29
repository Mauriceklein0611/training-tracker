import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import {
  addExerciseToSession,
  adjustRestTarget,
  deleteSession,
  endRest,
  finishSession,
  getSessionDetail,
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
import { loadAnalyticsDataset } from '@/services/dataset';
import { summarizeSession } from '@/services/sessionSummary';
import { workoutProgress } from '@/services/sessionProgress';
import { isCardio } from '@/services/metrics';
import { formatDuration } from '@/utils/date';
import { formatSections, formatSets } from '@/utils/format';

/**
 * Live workout view.
 *
 * This is the screen used while standing in the gym, so the layout stays
 * vertical and large: no tables, no dense grids, and every control is at least
 * 44 px tall. Every change is written to IndexedDB immediately.
 */
export default function LiveSessionPage() {
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

  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const rest = useActiveRest(detail, {
    soundEnabled: settings.restSoundEnabled,
    vibrationEnabled: settings.restVibrationEnabled,
    voiceEnabled: settings.voiceAnnouncementsEnabled,
  });

  const isActive = detail?.session.status === 'active';

  // Progressive enhancement: keep the display on while training, released
  // automatically when the workout ends or the setting is switched off.
  useWakeLock(isActive && settings.keepScreenAwake);

  const now = useNow(1000, isActive);
  const elapsedSeconds = detail
    ? Math.max(0, (now.getTime() - new Date(detail.session.startedAt).getTime()) / 1000)
    : 0;

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
          sets: entry.sets,
        })),
      ),
    [detail],
  );

  if (detail === undefined) {
    return (
      <p className="p-6 text-center text-sm text-muted" role="status">
        Trainingseinheit wird geladen …
      </p>
    );
  }

  if (!detail) {
    return (
      <div className="pt-6">
        <EmptyState
          title="Trainingseinheit nicht gefunden"
          description="Diese Einheit existiert nicht mehr."
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          }
        />
      </div>
    );
  }

  const handleFinish = async () => {
    await finishSession(sessionId);
    setFinishOpen(false);
    toast.show('Training abgeschlossen.', 'success');
    navigate(`/verlauf/${sessionId}`, { replace: true });
  };

  const handleDiscard = async () => {
    await deleteSession(sessionId);
    setDiscardOpen(false);
    toast.show('Training verworfen.', 'info');
    navigate('/', { replace: true });
  };

  return (
    <>
      {/* Reduced header: during a workout the app deliberately hides the main navigation. */}
      <header className="header-safe sticky top-0 z-30 -mx-4 mb-3 border-b border-border bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">
              {detail.session.name}
            </h1>
            <p className="numeric text-sm text-muted">
              {formatDuration(elapsedSeconds)} ·{' '}
              {isCardioOnly
                ? formatSections(completedSectionCount)
                : formatSets(completedSetCount)}
              {progress.totalExercises > 0
                ? ` · Übung ${Math.min(
                    progress.doneExercises + 1,
                    progress.totalExercises,
                  )} von ${progress.totalExercises}`
                : ''}
            </p>
            {progress.totalExercises > 0 ? (
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.totalExercises}
                aria-valuenow={progress.doneExercises}
                aria-label="Fortschritt der Übungen"
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
            label="Training verwerfen"
            onClick={() => setDiscardOpen(true)}
            className="shrink-0"
          >
            <X size={22} aria-hidden="true" />
          </IconButton>
          <Button variant="success" size="sm" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 size={18} aria-hidden="true" />
            Beenden
          </Button>
        </div>
      </header>

      {rest ? (
        <RestTimerBar
          rest={rest}
          onEndRest={() => void endRest(rest.set.id)}
          onAdjust={(delta) => void adjustRestTarget(rest.set.id, delta)}
        />
      ) : null}

      <div className="mb-3">
        <PreCheckInCard sessionId={sessionId} value={detail.session.preCheckIn} />
      </div>

      {detail.exercises.length === 0 ? (
        <EmptyState
          title="Noch keine Übungen"
          description="Füge die erste Übung hinzu. Du kannst Übungen jederzeit ergänzen, entfernen oder neu anordnen — auch mitten im Training."
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Übung hinzufügen
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
          Übung hinzufügen
        </Button>
      ) : null}

      <div className="mt-4">
        <TextAreaField
          label="Notiz zum Training"
          value={notes ?? detail.session.notes}
          placeholder="Wie lief die Einheit? Schlaf, Energie, Schmerzen …"
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
        Training beenden
      </Button>

      <ExercisePickerDialog
        open={pickerOpen}
        title={pickerCardioOnly ? 'Cardio-Aktivität wählen' : 'Übung hinzufügen'}
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
        title="Training beenden?"
        description={
          isCardioOnly
            ? 'Nicht abgeschlossene Abschnitte werden verworfen, alle erfassten Abschnitte bleiben gespeichert.'
            : 'Nicht abgeschlossene Sätze werden verworfen, alle erfassten Sätze bleiben gespeichert.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFinishOpen(false)}>
              Weiter trainieren
            </Button>
            <Button variant="success" onClick={() => void handleFinish()}>
              Training abschließen
            </Button>
          </>
        }
      >
        {summary ? (
          <SessionSummaryView summary={summary} />
        ) : (
          <p className="text-sm text-muted">Zusammenfassung wird berechnet …</p>
        )}
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title="Training verwerfen?"
        description={
          completedSetCount > 0
            ? `Diese Einheit enthält bereits ${
                isCardioOnly
                  ? formatSections(completedSectionCount)
                  : formatSets(completedSetCount)
              }. Beim Verwerfen werden sie endgültig gelöscht. Möchtest du sie stattdessen speichern, brich ab und wähle „Beenden“.`
            : 'Die Einheit wird ohne Speichern verworfen.'
        }
        confirmLabel="Endgültig verwerfen"
        cancelLabel="Abbrechen"
        destructive
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => void handleDiscard()}
      >
        <Button variant="secondary" fullWidth onClick={() => setDiscardOpen(false)}>
          <Trash2 size={18} aria-hidden="true" />
          Doch nicht verwerfen
        </Button>
      </ConfirmDialog>
    </>
  );
}
