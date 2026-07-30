import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation();
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
        <PageHeader title={t('unit.title')} backTo="/bibliothek" />
        <p className="text-center text-sm text-muted">{tCommon('state.loading')}</p>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <PageHeader title={t('unit.title')} backTo="/bibliothek" />
        <EmptyState
          title={t('unit.notFound.title')}
          description={t('unit.notFound.description')}
          action={
            <Button variant="primary" onClick={() => navigate('/bibliothek')}>
              {t('unit.notFound.back')}
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
      toast.show(t('unit.startFailed'), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={unit.name}
        subtitle={unit.description || undefined}
        backTo="/bibliothek"
        action={
          <IconButton label={t('unit.edit')} onClick={openEdit}>
            <Pencil size={20} aria-hidden="true" />
          </IconButton>
        }
      />

      <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
        <Plus size={18} aria-hidden="true" />
        {t('exercise.add')}
      </Button>

      {exercises.length === 0 ? (
        <EmptyState
          title={t('exercise.empty.title')}
          description={t('exercise.empty.description')}
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              {t('exercise.add')}
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
          {activeSession
            ? t('unit.startAlreadyRunning')
            : t('unit.startNamed', { name: unit.name })}
        </Button>
      ) : null}

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={async (exercise) => {
          await addExerciseToWorkoutUnit(unit.id, exercise);
        }}
      />

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={t('unit.edit')}>
        <div className="grid gap-3">
          <TextField
            label={t('field.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextAreaField
            label={t('field.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button variant="primary" fullWidth onClick={() => void handleSaveMeta()}>
            {tCommon('action.save')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
