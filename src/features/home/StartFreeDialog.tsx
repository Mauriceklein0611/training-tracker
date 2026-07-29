import { useLiveQuery } from 'dexie-react-hooks';
import { Layers, PlusCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { listWorkoutUnitsWithExercises } from '@/db/repositories/workoutUnits';
import { summariseWorkoutUnit } from '@/services/workoutUnitSummary';
import { formatSets } from '@/utils/format';

/**
 * Starting a free workout: either an empty session you fill with exercises as
 * you go, or a session started from a saved library unit. Both paths land in the
 * live view; this dialog only picks what the session starts with.
 */
export function StartFreeDialog({
  open,
  onClose,
  onStartEmpty,
  onStartUnit,
}: {
  open: boolean;
  onClose: () => void;
  onStartEmpty: () => void;
  onStartUnit: (unitId: string) => void;
}) {
  const units = useLiveQuery(
    () => (open ? listWorkoutUnitsWithExercises() : Promise.resolve([])),
    [open],
    [],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Freies Training starten"
      description="Beginne mit einer leeren Einheit oder starte aus einer gespeicherten Einheit."
    >
      <div className="grid gap-4">
        <Button
          variant="primary"
          fullWidth
          className="justify-start"
          onClick={onStartEmpty}
        >
          <PlusCircle size={18} aria-hidden="true" />
          Übungen selbst hinzufügen
        </Button>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Layers size={14} aria-hidden="true" />
            Aus Bibliothek starten
          </h3>
          {units.length === 0 ? (
            <p className="text-sm text-muted">
              Noch keine Übungseinheiten in der Bibliothek. Lege welche an, um sie hier
              direkt zu starten.
            </p>
          ) : (
            <ul className="grid gap-2">
              {units.map(({ unit, exercises }) => {
                const summary = summariseWorkoutUnit(exercises);
                return (
                  <li key={unit.id}>
                    <button
                      type="button"
                      onClick={() => onStartUnit(unit.id)}
                      className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors active:bg-surface-3"
                    >
                      <p className="truncate font-medium">{unit.name}</p>
                      <p className="numeric text-xs text-muted">
                        {summary.exerciseCount}{' '}
                        {summary.exerciseCount === 1 ? 'Übung' : 'Übungen'} ·{' '}
                        {formatSets(summary.totalTargetSets)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
