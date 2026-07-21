import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Card';
import { CheckboxField, SelectField, TextField } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  collectFilterValues,
  deleteExercise,
  filterExercises,
  isExerciseInUse,
  listExercises,
  setExerciseArchived,
} from '@/db/repositories/exercises';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import type { Exercise } from '@/types';
import { TRACKING_TYPE_LABELS, WEIGHT_MODE_LABELS } from '@/utils/format';

export default function ExercisesPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const exercises = useLiveQuery(() => listExercises(), [], []);

  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Exercise | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const filters = useMemo(() => collectFilterValues(exercises), [exercises]);
  const visible = useMemo(
    () => filterExercises(exercises, { search, muscleGroup, equipment, showArchived }),
    [exercises, search, muscleGroup, equipment, showArchived],
  );
  const existingNames = useMemo(() => exercises.map((exercise) => exercise.name), [exercises]);
  const archivedCount = exercises.filter((exercise) => exercise.archived).length;

  const handleArchive = async (exercise: Exercise) => {
    await setExerciseArchived(exercise.id, !exercise.archived);
    toast.show(exercise.archived ? 'Übung wiederhergestellt.' : 'Übung archiviert.', 'success');
  };

  /**
   * Deleting is only offered when no session references the exercise.
   * Otherwise the user is told to archive it, which keeps history correct.
   */
  const handleDeleteRequest = async (exercise: Exercise) => {
    if (await isExerciseInUse(exercise.id)) {
      toast.show(
        'Diese Übung wurde bereits trainiert und kann nicht gelöscht werden. Archiviere sie stattdessen.',
        'error',
      );
      return;
    }
    setDeleteTarget(exercise);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExercise(deleteTarget.id);
      toast.show('Übung gelöscht.', 'success');
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Übungen"
        backTo="/mehr"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Neu
          </Button>
        }
      />

      <div className="mb-4 grid gap-3">
        <TextField
          label="Suchen"
          type="search"
          value={search}
          placeholder="Name, Muskelgruppe, Equipment"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Muskelgruppe"
            value={muscleGroup}
            onChange={(event) => setMuscleGroup(event.target.value)}
          >
            <option value="">Alle</option>
            {filters.muscleGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Equipment"
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
          >
            <option value="">Alle</option>
            {filters.equipment.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
        </div>
        {archivedCount > 0 ? (
          <CheckboxField
            label={`Archivierte Übungen anzeigen (${archivedCount})`}
            checked={showArchived}
            onChange={setShowArchived}
          />
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={exercises.length === 0 ? 'Noch keine Übungen' : 'Keine Treffer'}
          description={
            exercises.length === 0
              ? 'Lege deine Übungen selbst an — die App bringt bewusst keine vorgefertigten Daten mit. Für jede Übung legst du fest, wie sie erfasst wird und wie das Gewicht zu verstehen ist.'
              : 'Passe Suche oder Filter an.'
          }
          action={
            exercises.length === 0 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus size={18} aria-hidden="true" />
                Erste Übung anlegen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-2">
          {visible.map((exercise) => (
            <li
              key={exercise.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{exercise.name}</span>
                    {exercise.archived ? <Badge tone="warning">Archiviert</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {[exercise.primaryMuscleGroup, exercise.equipment]
                      .filter(Boolean)
                      .join(' · ') || 'Ohne Zuordnung'}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {TRACKING_TYPE_LABELS[exercise.trackingType]} ·{' '}
                    {WEIGHT_MODE_LABELS[exercise.weightMode]}
                    {exercise.weightMode === 'per_hand'
                      ? ` (×${exercise.weightMultiplier})`
                      : ''}{' '}
                    · Pause {exercise.defaultRestSeconds}s
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={`${exercise.name} bearbeiten`}
                    onClick={() => {
                      setEditing(exercise);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={
                      exercise.archived
                        ? `${exercise.name} wiederherstellen`
                        : `${exercise.name} archivieren`
                    }
                    onClick={() => void handleArchive(exercise)}
                  >
                    {exercise.archived ? (
                      <ArchiveRestore size={18} aria-hidden="true" />
                    ) : (
                      <Archive size={18} aria-hidden="true" />
                    )}
                  </IconButton>
                  <IconButton
                    label={`${exercise.name} löschen`}
                    onClick={() => void handleDeleteRequest(exercise)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ExerciseFormDialog
        open={formOpen}
        exercise={editing}
        existingNames={existingNames}
        defaultRestSeconds={settings.defaultRestSeconds}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Übung löschen?"
        description={`„${deleteTarget?.name ?? ''}“ wird endgültig entfernt. Diese Übung wurde noch in keinem Training verwendet, es gehen also keine Trainingsdaten verloren.`}
        confirmLabel="Endgültig löschen"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
