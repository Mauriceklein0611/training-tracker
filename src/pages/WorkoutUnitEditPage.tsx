import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Play, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import {
  addExerciseToWorkoutUnit,
  getWorkoutUnitWithExercises,
  updateWorkoutUnit,
} from '@/db/repositories/workoutUnits';
import {
  ActiveSessionExistsError,
  startSessionFromWorkoutUnit,
} from '@/db/repositories/sessions';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { WorkoutUnitExerciseRow } from '@/features/templates/WorkoutUnitExerciseRow';
import { WorkoutUnitGroupHeader } from '@/features/templates/WorkoutUnitGroupHeader';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import {
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  groupItems,
  memberLabel,
} from '@/services/grouping';

export default function WorkoutUnitEditPage() {
  const { unitId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();
  // `undefined` means still loading; `null` means the unit does not exist.
  const data = useLiveQuery(
    async () => (await getWorkoutUnitWithExercises(unitId)) ?? null,
    [unitId],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  if (data === undefined) {
    return (
      <>
        <PageHeader title="Übungseinheit" backTo="/bibliothek" />
        <p className="text-center text-sm text-muted">Wird geladen …</p>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <PageHeader title="Übungseinheit" backTo="/bibliothek" />
        <EmptyState
          title="Nicht gefunden"
          description="Diese Übungseinheit existiert nicht mehr."
          action={
            <Button variant="primary" onClick={() => navigate('/bibliothek')}>
              Zur Bibliothek
            </Button>
          }
        />
      </>
    );
  }

  const { unit, exercises } = data;
  const blocks = groupItems(exercises);
  const indexById = new Map(exercises.map((entry, index) => [entry.id, index]));

  const openEdit = () => {
    setName(unit.name);
    setDescription(unit.description);
    setEditOpen(true);
  };

  const handleSaveMeta = async () => {
    await updateWorkoutUnit(unit.id, {
      name: name.trim() || unit.name,
      description: description.trim(),
    });
    setEditOpen(false);
  };

  const handleStart = async () => {
    try {
      const session = await startSessionFromWorkoutUnit(unit.id);
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

  return (
    <>
      <PageHeader
        title={unit.name}
        subtitle={unit.description || undefined}
        backTo="/bibliothek"
        action={
          <IconButton label="Einheit bearbeiten" onClick={openEdit}>
            <Pencil size={20} aria-hidden="true" />
          </IconButton>
        }
      />

      <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
        <Plus size={18} aria-hidden="true" />
        Übung hinzufügen
      </Button>

      {exercises.length === 0 ? (
        <EmptyState
          title="Noch keine Übungen"
          description="Füge Übungen zu dieser Einheit hinzu. Ziele und Gruppen kannst du danach direkt hier einstellen."
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Übung hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="mt-3 grid gap-3">
          {blocks.map((block) => {
            const rows = block.members.map((entry, memberIndex) => (
              <WorkoutUnitExerciseRow
                key={entry.id}
                entry={entry}
                exercise={entry.exercise}
                label={memberLabel(block, memberIndex)}
                globalIndex={indexById.get(entry.id) ?? 0}
                total={exercises.length}
                grouped={block.groupId != null}
                canGroupWithPrevious={(indexById.get(entry.id) ?? 0) > 0}
              />
            ));

            if (block.groupId == null) return rows;

            return (
              <div
                key={block.key}
                className="rounded-2xl border border-accent/40 bg-surface-2/40 p-2"
              >
                <WorkoutUnitGroupHeader
                  unitId={unit.id}
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
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          disabled={Boolean(activeSession)}
          onClick={() => void handleStart()}
        >
          <Play size={20} aria-hidden="true" />
          {activeSession ? 'Training läuft bereits' : `„${unit.name}“ starten`}
        </Button>
      ) : null}

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={async (exercise) => {
          await addExerciseToWorkoutUnit(unit.id, exercise);
        }}
      />

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Einheit bearbeiten"
      >
        <div className="grid gap-3">
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextAreaField
            label="Beschreibung"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button variant="primary" fullWidth onClick={() => void handleSaveMeta()}>
            Speichern
          </Button>
        </div>
      </Dialog>
    </>
  );
}
