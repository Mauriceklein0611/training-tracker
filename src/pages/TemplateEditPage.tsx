import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import {
  addExerciseToTemplate,
  getTemplateWithExercises,
  reorderTemplateExercises,
  updateTemplate,
} from '@/db/repositories/templates';
import {
  addDay,
  deleteDay,
  duplicateDay,
  getPlanWithDays,
  LastDayError,
  moveDay,
  setPlanDeload,
  SPLIT_TYPE_LABELS,
  updatePlan,
} from '@/db/repositories/plans';
import {
  ActiveSessionExistsError,
  startSessionFromTemplate,
} from '@/db/repositories/sessions';
import { DELOAD_INTENSITY_LABELS } from '@/services/deload';
import type { DeloadIntensity } from '@/types';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { PlanDayTabs } from '@/features/plans/PlanDayTabs';
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

  const handleAddDay = async () => {
    const day = await addDay(plan.plan.id);
    setSelectedDayId(day.id);
    toast.show('Trainingstag hinzugefügt.', 'success');
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

      {plan.plan.deloadIntensity ? (
        <p className="mb-3 rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
          Deload aktiv ({DELOAD_INTENSITY_LABELS[plan.plan.deloadIntensity]}) — die
          Ziel-Sätze werden beim Start reduziert.
        </p>
      ) : null}

      {plan.plan.description ? (
        <p className="mb-4 whitespace-pre-line break-words rounded-2xl border border-border bg-surface p-3 text-sm leading-relaxed text-muted">
          {plan.plan.description}
        </p>
      ) : null}

      {/* Schedule: how the plan's units are laid out over time (rotation, cycle, week). */}
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        className="mb-4 justify-start"
        onClick={() => setScheduleOpen(true)}
      >
        <CalendarRange size={18} className="text-accent" aria-hidden="true" />
        Zeitplan &amp; Pausentage
      </Button>

      {/* Day navigation — hidden for a single-day plan to stay simple. */}
      {isSingleDay ? null : (
        <PlanDayTabs
          days={days}
          activeDayId={activeDayId}
          onSelect={setSelectedDayId}
          onAdd={() => void handleAddDay()}
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

      <Link
        to={`/plaene/${activeDayId}/versionen`}
        className="mt-4 flex min-h-[48px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium active:bg-surface-2"
      >
        <History size={18} className="text-accent" aria-hidden="true" />
        Versionen dieses Tages
      </Link>

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
        deloadIntensity={plan.plan.deloadIntensity}
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
  deloadIntensity,
  onClose,
}: {
  open: boolean;
  planId: string;
  name: string;
  description: string;
  deloadIntensity?: DeloadIntensity;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const [draftDeload, setDraftDeload] = useState<string>(deloadIntensity ?? '');

  // Re-seed the fields whenever the dialog is (re)opened for the current plan.
  const [seededFor, setSeededFor] = useState('');
  if (open && seededFor !== `${planId}:${name}:${description}:${deloadIntensity ?? ''}`) {
    setDraftName(name);
    setDraftDescription(description);
    setDraftDeload(deloadIntensity ?? '');
    setSeededFor(`${planId}:${name}:${description}:${deloadIntensity ?? ''}`);
  }

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.show('Bitte gib einen Namen ein.', 'error');
      return;
    }
    await updatePlan(planId, { name: trimmed, description: draftDescription });
    await setPlanDeload(
      planId,
      (draftDeload || undefined) as DeloadIntensity | undefined,
    );
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
        <SelectField
          label="Deload"
          hint="Reduziert die Ziel-Sätze aller Tage beim Trainingsstart. Ausschalten stellt die vollen Werte sofort wieder her."
          value={draftDeload}
          onChange={(event) => setDraftDeload(event.target.value)}
        >
          <option value="">Aus</option>
          <option value="light">{DELOAD_INTENSITY_LABELS.light}</option>
          <option value="medium">{DELOAD_INTENSITY_LABELS.medium}</option>
          <option value="strong">{DELOAD_INTENSITY_LABELS.strong}</option>
        </SelectField>
      </div>
    </Dialog>
  );
}
