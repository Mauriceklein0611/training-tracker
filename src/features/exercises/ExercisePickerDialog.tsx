import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { CheckboxField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Card';
import { db } from '@/db/db';
import { filterExercises, listExercises } from '@/db/repositories/exercises';
import { isExerciseAvailable } from '@/db/repositories/equipmentProfiles';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import { useSettings } from '@/hooks/useSettings';
import type { Exercise } from '@/types';
import { muscleGroupDisplayLabel } from '@/constants/muscleGroups';

/**
 * Picker used by the plan editor and the live view.
 * Includes a shortcut for creating an exercise on the spot, so a workout never
 * has to be interrupted just because an exercise is missing.
 */
export function ExercisePickerDialog({
  open,
  onClose,
  onSelect,
  title,
  trackingTypeFilter,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
  /** When set, only exercises of this tracking type are listed (e.g. cardio). */
  trackingTypeFilter?: Exercise['trackingType'];
}) {
  const { t } = useTranslation('more');
  const { t: tDomain } = useTranslation('domain');
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const exercises = useLiveQuery(() => listExercises(), [], []);

  const activeProfile = useLiveQuery(async () => {
    const id = settings.activeEquipmentProfileId;
    return id ? db.equipmentProfiles.get(id) : undefined;
  }, [settings.activeEquipmentProfileId]);

  const visible = useMemo(() => {
    let bySearch = filterExercises(exercises, { search, showArchived: false });
    if (trackingTypeFilter) {
      bySearch = bySearch.filter(
        (exercise) => exercise.trackingType === trackingTypeFilter,
      );
    }
    if (!activeProfile || !onlyAvailable) return bySearch;
    return bySearch.filter((exercise) => isExerciseAvailable(exercise, activeProfile));
  }, [exercises, search, activeProfile, onlyAvailable, trackingTypeFilter]);

  const existingNames = useMemo(
    () => exercises.map((exercise) => exercise.name),
    [exercises],
  );

  return (
    <>
      <Dialog
        open={open && !createOpen}
        onClose={onClose}
        title={title ?? t('screens.exercise.picker.defaultTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('screens.action.cancel')}
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              {t('screens.exercise.picker.newExercise')}
            </Button>
          </>
        }
      >
        <TextField
          label={t('screens.exercise.picker.search')}
          type="search"
          value={search}
          placeholder={t('screens.exercise.picker.searchPlaceholder')}
          onChange={(event) => setSearch(event.target.value)}
        />

        {activeProfile ? (
          <div className="mt-3">
            <CheckboxField
              label={t('screens.exercise.picker.onlyAvailable', {
                name: activeProfile.name,
              })}
              checked={onlyAvailable}
              onChange={setOnlyAvailable}
            />
          </div>
        ) : null}

        <div className="mt-3">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Search size={24} aria-hidden="true" />}
              title={
                exercises.length === 0
                  ? t('screens.exercise.picker.emptyTitle')
                  : t('screens.exercise.picker.noMatchTitle')
              }
              description={
                exercises.length === 0
                  ? t('screens.exercise.picker.emptyDescription')
                  : t('screens.exercise.picker.noMatchDescription')
              }
              action={
                search.trim() ? (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus size={18} aria-hidden="true" />
                    {t('screens.exercise.picker.createFromSearch', {
                      name: search.trim(),
                    })}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-1">
              {visible.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(exercise);
                      setSearch('');
                    }}
                    className="flex w-full min-h-[56px] items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left active:bg-surface-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{exercise.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[
                          exercise.primaryMuscleGroup
                            ? muscleGroupDisplayLabel(exercise.primaryMuscleGroup)
                            : undefined,
                          exercise.equipment,
                        ]
                          .filter(Boolean)
                          .join(' · ') ||
                          tDomain(`trackingType.${exercise.trackingType}`)}
                      </span>
                    </span>
                    <Plus size={18} className="shrink-0 text-accent" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      <ExerciseFormDialog
        open={createOpen}
        existingNames={existingNames}
        initialName={search}
        onClose={() => setCreateOpen(false)}
        onSaved={(exercise) => {
          setCreateOpen(false);
          setSearch('');
          onSelect(exercise);
        }}
      />
    </>
  );
}
