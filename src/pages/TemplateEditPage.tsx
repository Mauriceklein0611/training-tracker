import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Pencil,
  Play,
  Plus,
  Settings2,
  Target,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import {
  addExerciseToTemplate,
  getTemplateWithExercises,
  reorderTemplateExercises,
  updateTemplate,
} from '@/db/repositories/templates';
import {
  deleteDay,
  duplicateDay,
  getPlanWithDays,
  LastDayError,
  moveDay,
  SPLIT_TYPE_LABELS,
  updatePlan,
} from '@/db/repositories/plans';
import {
  ActiveSessionExistsError,
  startSessionFromTemplate,
} from '@/db/repositories/sessions';
import { saveTemplateAsWorkoutUnit } from '@/db/repositories/workoutUnits';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { AddDayDialog } from '@/features/plans/AddDayDialog';
import { PlanCalendarView } from '@/features/plans/PlanCalendarView';
import { PlanDayTabs } from '@/features/plans/PlanDayTabs';
import { PlanDeloadCard } from '@/features/plans/PlanDeloadCard';
import { PlanGoalsDialog } from '@/features/plans/PlanGoalsDialog';
import { PlanOverviewCard } from '@/features/plans/PlanOverviewCard';
import { ScheduleEditor } from '@/features/plans/ScheduleEditor';
import { TemplateExerciseRow } from '@/features/templates/TemplateExerciseRow';
import { TemplateGroupHeader } from '@/features/templates/TemplateGroupHeader';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import {
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  groupItems,
  memberLabel,
} from '@/services/grouping';

export default function TemplateEditPage() {
  const { planId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();

  const plan = useLiveQuery(() => getPlanWithDays(planId), [planId]);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameDayOpen, setRenameDayOpen] = useState(false);
  const [dayName, setDayName] = useState('');
  const [deleteDayOpen, setDeleteDayOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addDayOpen, setAddDayOpen] = useState(false);

  const days = plan?.days ?? [];
  // Keep a valid active day even as days are added/removed.
  const activeDayId = days.some((day) => day.id === selectedDayId)
    ? selectedDayId
    : (days[0]?.id ?? '');
  const activeDay = days.find((day) => day.id === activeDayId);

  const dayData = useLiveQuery(
    () => (activeDayId ? getTemplateWithExercises(activeDayId) : undefined),
    [activeDayId],
  );

  if (plan === undefined) {
    return (
      <>
        <PageHeader title="Plan" backTo="/plaene" />
        <p className="text-sm text-muted" role="status">
          Wird geladen …
        </p>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <PageHeader title="Plan" backTo="/plaene" />
        <EmptyState
          title="Plan nicht gefunden"
          description="Dieser Trainingsplan existiert nicht mehr."
          action={
            <Button variant="primary" onClick={() => navigate('/plaene')}>
              Zurück zur Übersicht
            </Button>
          }
        />
      </>
    );
  }

  const exercises = dayData?.exercises ?? [];
  const blocks = groupItems(exercises);
  const indexById = new Map(exercises.map((entry, index) => [entry.id, index]));
  const dayIndex = days.findIndex((day) => day.id === activeDayId);

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId || !activeDayId) return;
    const ids = exercises.map((entry) => entry.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    await reorderTemplateExercises(activeDayId, ids);
    setDragId(null);
  };

  const handleStart = async () => {
    if (!activeDayId) return;
    try {
      const session = await startSessionFromTemplate(activeDayId);
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(
        error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        'error',
      );
    }
  };

  const handleSaveAsUnit = async () => {
    if (!activeDayId) return;
    await saveTemplateAsWorkoutUnit(activeDayId);
    toast.show('Als Übungseinheit in der Bibliothek gespeichert.', 'success');
  };

  const handleDeleteDay = async () => {
    try {
      await deleteDay(activeDayId);
      setSelectedDayId('');
      setDeleteDayOpen(false);
      toast.show('Trainingstag gelöscht.', 'success');
    } catch (error) {
      setDeleteDayOpen(false);
      toast.show(
        error instanceof LastDayError ? error.message : 'Löschen fehlgeschlagen.',
        'error',
      );
    }
  };

  const isSingleDay = days.length === 1;

  return (
    <>
      <PageHeader
        title={plan.plan.name}
        subtitle={`${SPLIT_TYPE_LABELS[plan.plan.splitType]} · ${days.length} ${
          days.length === 1 ? 'Tag' : 'Tage'
        }`}
        backTo="/plaene"
        action={
          <IconButton label="Plan-Einstellungen" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={20} aria-hidden="true" />
          </IconButton>
        }
      />

      {plan.plan.description ? (
        <p className="mb-4 whitespace-pre-line break-words rounded-2xl border border-border bg-surface p-3 text-sm leading-relaxed text-muted">
          {plan.plan.description}
        </p>
      ) : null}

      {/* Plan dashboard: activate + light overview derived from completed sessions. */}
      <PlanOverviewCard plan={plan.plan} />

      {/* Time-boxed 7-day deload (Phase 5). */}
      <PlanDeloadCard planId={plan.plan.id} />

      {/* Schedule: how the plan's units are laid out over time (rotation, cycle, week). */}
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        className="mb-2 justify-start"
        onClick={() => setScheduleOpen(true)}
      >
        <CalendarRange size={18} className="text-accent" aria-hidden="true" />
        Zeitplan &amp; Pausentage
      </Button>

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        className="mb-2 justify-start"
        onClick={() => setCalendarOpen(true)}
      >
        <CalendarDays size={18} className="text-accent" aria-hidden="true" />
        Kalender
      </Button>

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        className="mb-4 justify-start"
        onClick={() => setGoalsOpen(true)}
      >
        <Target size={18} className="text-accent" aria-hidden="true" />
        Ziele &amp; Fokus
      </Button>

      {/* Day navigation — hidden for a single-day plan to stay simple. */}
      {isSingleDay ? null : (
        <PlanDayTabs
          days={days}
          activeDayId={activeDayId}
          onSelect={setSelectedDayId}
          onAdd={() => setAddDayOpen(true)}
        />
      )}

      {/* Day toolbar: rename / reorder / duplicate / delete the active day. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDayName(activeDay?.name ?? '');
              setRenameDayOpen(true);
            }}
          >
            <Pencil size={16} aria-hidden="true" />
            {activeDay?.name}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {!isSingleDay ? (
            <>
              <IconButton
                label="Tag nach links"
                onClick={() => void moveDay(activeDayId, -1)}
                {...(dayIndex <= 0 ? { disabled: true } : {})}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Tag nach rechts"
                onClick={() => void moveDay(activeDayId, 1)}
                {...(dayIndex >= days.length - 1 ? { disabled: true } : {})}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </IconButton>
            </>
          ) : null}
          <IconButton
            label="Tag duplizieren"
            onClick={async () => {
              const copy = await duplicateDay(activeDayId);
              setSelectedDayId(copy.id);
              toast.show('Trainingstag dupliziert.', 'success');
            }}
          >
            <Copy size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Tag löschen"
            onClick={() => setDeleteDayOpen(true)}
            {...(isSingleDay ? { disabled: true } : {})}
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus size={18} aria-hidden="true" />
          Übung
        </Button>
      </div>

      {exercises.length === 0 ? (
        <EmptyState
          title="Noch keine Übungen an diesem Tag"
          description="Füge Übungen hinzu und lege Ziel-Sätze, Ziel-Wiederholungen und die Pausenzeit fest. Die Reihenfolge kannst du jederzeit ändern."
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Übung hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {blocks.map((block) => {
            const rows = block.members.map((entry, memberIndex) => (
              <TemplateExerciseRow
                key={entry.id}
                entry={entry}
                exercise={entry.exercise}
                label={memberLabel(block, memberIndex)}
                globalIndex={indexById.get(entry.id) ?? 0}
                total={exercises.length}
                grouped={block.groupId != null}
                canGroupWithPrevious={(indexById.get(entry.id) ?? 0) > 0}
                onDragStart={() => setDragId(entry.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(entry.id)}
                onDragEnd={() => setDragId(null)}
              />
            ));

            if (block.groupId == null) return rows;

            return (
              <div
                key={block.key}
                className="rounded-2xl border border-accent/40 bg-surface-2/40 p-2"
              >
                <TemplateGroupHeader
                  templateId={activeDayId}
                  groupId={block.groupId}
                  letter={block.letter}
                  groupType={block.groupType ?? DEFAULT_GROUP_TYPE}
                  groupRestMode={block.groupRestMode ?? DEFAULT_GROUP_REST_MODE}
                  memberCount={block.members.length}
                />
                <div className="grid gap-2">{rows}</div>
              </div>
            );
          })}
        </div>
      )}

      {exercises.length > 0 ? (
        <button
          type="button"
          onClick={() => void handleSaveAsUnit()}
          className="mt-4 flex min-h-[48px] w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium active:bg-surface-2"
        >
          <Layers size={18} className="text-accent" aria-hidden="true" />
          Als Übungseinheit in Bibliothek speichern
        </button>
      ) : null}

      {exercises.length > 0 ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          disabled={Boolean(activeSession)}
          onClick={() => void handleStart()}
        >
          <Play size={20} aria-hidden="true" />
          {activeSession ? 'Training läuft bereits' : `„${activeDay?.name}“ starten`}
        </Button>
      ) : null}

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={async (exercise) => {
          if (activeDayId) await addExerciseToTemplate(activeDayId, exercise);
          setPickerOpen(false);
        }}
      />

      <PlanSettingsDialog
        open={settingsOpen}
        planId={plan.plan.id}
        name={plan.plan.name}
        description={plan.plan.description}
        onClose={() => setSettingsOpen(false)}
      />

      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Zeitplan"
        size="lg"
      >
        <ScheduleEditor planId={plan.plan.id} />
      </Dialog>

      <AddDayDialog
        open={addDayOpen}
        planId={plan.plan.id}
        onClose={() => setAddDayOpen(false)}
        onDayAdded={(dayId) => {
          setSelectedDayId(dayId);
          setAddDayOpen(false);
        }}
      />

      <PlanGoalsDialog
        plan={plan.plan}
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
      />

      <Dialog
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        title="Kalender"
        size="lg"
      >
        <PlanCalendarView plan={plan.plan} />
      </Dialog>

      <Dialog
        open={renameDayOpen}
        onClose={() => setRenameDayOpen(false)}
        title="Trainingstag umbenennen"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameDayOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const trimmed = dayName.trim();
                if (!trimmed) {
                  toast.show('Bitte gib einen Namen ein.', 'error');
                  return;
                }
                await updateTemplate(activeDayId, { name: trimmed });
                setRenameDayOpen(false);
              }}
            >
              Speichern
            </Button>
          </>
        }
      >
        <TextField
          label="Name des Trainingstags"
          value={dayName}
          onChange={(event) => setDayName(event.target.value)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteDayOpen}
        title="Trainingstag löschen?"
        description={`„${activeDay?.name ?? ''}“ mit ${exercises.length} ${
          exercises.length === 1 ? 'Übung' : 'Übungen'
        } wird entfernt. Bereits absolvierte Trainings bleiben vollständig erhalten.`}
        confirmLabel="Tag löschen"
        destructive
        onCancel={() => setDeleteDayOpen(false)}
        onConfirm={() => void handleDeleteDay()}
      />
    </>
  );
}

/** Plan-level settings: name, description and the non-destructive deload toggle. */
function PlanSettingsDialog({
  open,
  planId,
  name,
  description,
  onClose,
}: {
  open: boolean;
  planId: string;
  name: string;
  description: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);

  // Re-seed the fields whenever the dialog is (re)opened for the current plan.
  const [seededFor, setSeededFor] = useState('');
  if (open && seededFor !== `${planId}:${name}:${description}`) {
    setDraftName(name);
    setDraftDescription(description);
    setSeededFor(`${planId}:${name}:${description}`);
  }

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.show('Bitte gib einen Namen ein.', 'error');
      return;
    }
    await updatePlan(planId, { name: trimmed, description: draftDescription });
    onClose();
    toast.show('Plan gespeichert.', 'success');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plan-Einstellungen"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void handleSave()}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Planname"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
        />
        <TextAreaField
          label="Beschreibung"
          value={draftDescription}
          placeholder="Optional"
          onChange={(event) => setDraftDescription(event.target.value)}
        />
        <p className="text-xs text-muted">
          Einen Deload startest du unten in der Plan-Ansicht („Deload") — als zeitlich
          begrenzte Woche, ohne die Planwerte zu überschreiben.
        </p>
      </div>
    </Dialog>
  );
}
