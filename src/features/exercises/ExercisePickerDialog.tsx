import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Card';
import { filterExercises, listExercises } from '@/db/repositories/exercises';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import type { Exercise } from '@/types';
import { TRACKING_TYPE_LABELS } from '@/utils/format';

/**
 * Picker used by the plan editor and the live view.
 * Includes a shortcut for creating an exercise on the spot, so a workout never
 * has to be interrupted just because an exercise is missing.
 */
export function ExercisePickerDialog({
  open,
  onClose,
  onSelect,
  title = 'Übung hinzufügen',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const exercises = useLiveQuery(() => listExercises(), [], []);

  const visible = useMemo(
    () => filterExercises(exercises, { search, showArchived: false }),
    [exercises, search],
  );

  const existingNames = useMemo(() => exercises.map((exercise) => exercise.name), [exercises]);

  return (
    <>
      <Dialog
        open={open && !createOpen}
        onClose={onClose}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Neue Übung
            </Button>
          </>
        }
      >
        <TextField
          label="Suchen"
          type="search"
          value={search}
          placeholder="Name, Muskelgruppe oder Equipment"
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="mt-3">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Search size={24} aria-hidden="true" />}
              title={exercises.length === 0 ? 'Noch keine Übungen' : 'Keine Treffer'}
              description={
                exercises.length === 0
                  ? 'Lege deine erste Übung an. Du bestimmst dabei, wie sie erfasst wird — mit Gewicht, mit Körpergewicht oder auf Zeit.'
                  : 'Passe die Suche an oder lege eine neue Übung an.'
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
                        {[exercise.primaryMuscleGroup, exercise.equipment]
                          .filter(Boolean)
                          .join(' · ') || TRACKING_TYPE_LABELS[exercise.trackingType]}
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
        onClose={() => setCreateOpen(false)}
        onSaved={(exercise) => {
          setCreateOpen(false);
          onSelect(exercise);
        }}
      />
    </>
  );
}
