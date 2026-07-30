import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
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
import type { Exercise, ExerciseOrigin } from '@/types';
import { MuscleGroupChips } from '@/features/exercises/MuscleGroupChips';
import { trackingTypeLabel, weightModeLabel } from '@/utils/format';
import { muscleGroupDisplayLabel } from '@/constants/muscleGroups';
import { exerciseDisplayName, exerciseSearchText } from '@/utils/exerciseDisplay';

export default function ExercisesPage() {
  // The local variable `exercises` holds the rows, so the namespace hook is
  // named explicitly rather than shadowing it.
  const { t } = useTranslation('exercises');
  const toast = useToast();
  const { settings } = useSettings();
  const exercises = useLiveQuery(() => listExercises(), [], []);

  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [origin, setOrigin] = useState<'' | ExerciseOrigin>('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Exercise | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const filters = useMemo(() => collectFilterValues(exercises), [exercises]);
  const visible = useMemo(() => {
    const filtered = filterExercises(exercises, {
      muscleGroup,
      equipment,
      origin: origin || undefined,
      showArchived,
    });
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return filtered;
    return filtered.filter((exercise) =>
      exerciseSearchText(exercise).toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [exercises, search, muscleGroup, equipment, origin, showArchived]);
  const existingNames = useMemo(
    () => exercises.map((exercise) => exercise.name),
    [exercises],
  );
  const archivedCount = exercises.filter((exercise) => exercise.archived).length;

  const handleArchive = async (exercise: Exercise) => {
    await setExerciseArchived(exercise.id, !exercise.archived);
    toast.show(exercise.archived ? t('toast.restored') : t('toast.archived'), 'success');
  };

  /**
   * Deleting is only offered when no session references the exercise.
   * Otherwise the user is told to archive it, which keeps history correct.
   */
  const handleDeleteRequest = async (exercise: Exercise) => {
    if (await isExerciseInUse(exercise.id)) {
      toast.show(t('toast.usedInTraining'), 'error');
      return;
    }
    setDeleteTarget(exercise);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExercise(deleteTarget.id);
      toast.show(t('toast.deleted'), 'success');
    } catch {
      toast.show(t('toast.deleteFailed'), 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('title')}
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
            {t('new')}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3">
        <TextField
          label={t('search.label')}
          type="search"
          value={search}
          placeholder={t('search.placeholder')}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label={t('filter.originLabel')}
          value={origin}
          onChange={(event) => setOrigin(event.target.value as '' | ExerciseOrigin)}
        >
          <option value="">{t('filter.all')}</option>
          <option value="system">{t('filter.originSystem')}</option>
          <option value="custom">{t('filter.originCustom')}</option>
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t('filter.muscleGroup')}
            value={muscleGroup}
            onChange={(event) => setMuscleGroup(event.target.value)}
          >
            <option value="">{t('filter.all')}</option>
            {filters.muscleGroups.map((group) => (
              <option key={group} value={group}>
                {muscleGroupDisplayLabel(group)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('filter.equipment')}
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
          >
            <option value="">{t('filter.all')}</option>
            {filters.equipment.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
        </div>
        {archivedCount > 0 ? (
          <CheckboxField
            label={t('filter.showArchived', { count: archivedCount })}
            checked={showArchived}
            onChange={setShowArchived}
          />
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={exercises.length === 0 ? t('empty.noneTitle') : t('empty.noMatchTitle')}
          description={
            exercises.length === 0
              ? t('empty.noneDescription')
              : t('empty.noMatchDescription')
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
                {t('empty.noneAction')}
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
                    <Link
                      to={`/mehr/uebungen/${exercise.id}`}
                      className="truncate text-accent underline-offset-2 hover:underline"
                    >
                      {exerciseDisplayName(exercise)}
                    </Link>
                    {exercise.origin === 'system' ? (
                      <Badge tone="accent">System</Badge>
                    ) : null}
                    {exercise.archived ? (
                      <Badge tone="warning">{t('row.archivedBadge')}</Badge>
                    ) : null}
                  </p>
                  {exercise.primaryMuscleGroup ||
                  exercise.secondaryMuscleGroups.length > 0 ? (
                    <div className="mt-1">
                      <MuscleGroupChips
                        primary={exercise.primaryMuscleGroup || undefined}
                        secondary={exercise.secondaryMuscleGroups}
                      />
                    </div>
                  ) : null}
                  {exercise.equipment ? (
                    <p className="mt-1 text-sm text-muted">{exercise.equipment}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    {trackingTypeLabel(exercise.trackingType)} ·{' '}
                    {weightModeLabel(exercise.weightMode)}
                    {exercise.weightMode === 'per_hand'
                      ? ` (×${exercise.weightMultiplier})`
                      : ''}{' '}
                    · {t('row.rest', { seconds: exercise.defaultRestSeconds })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={t('row.edit', { name: exerciseDisplayName(exercise) })}
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
                        ? t('row.restore', { name: exerciseDisplayName(exercise) })
                        : t('row.archive', { name: exerciseDisplayName(exercise) })
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
                    label={t('row.delete', { name: exerciseDisplayName(exercise) })}
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
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', {
          name: deleteTarget ? exerciseDisplayName(deleteTarget) : '',
        })}
        confirmLabel={t('deleteDialog.confirm')}
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
