import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Layers } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { addDay } from '@/db/repositories/plans';
import {
  addWorkoutUnitToPlan,
  listWorkoutUnitsWithExercises,
} from '@/db/repositories/workoutUnits';
import { summariseWorkoutUnit } from '@/services/workoutUnitSummary';
import { useToast } from '@/hooks/useToast';
import { formatSets } from '@/utils/format';

/**
 * Adds a training day to a plan — either an empty day, or a copy of a workout
 * unit from the library. Importing reuses `addWorkoutUnitToPlan`, which copies
 * the unit's exercises into a new day and records where it came from; the stored
 * library unit is never changed.
 */
export function AddDayDialog({
  open,
  planId,
  onClose,
  onDayAdded,
}: {
  open: boolean;
  planId: string;
  onClose: () => void;
  /** Called with the new day's id so the editor can select it. */
  onDayAdded: (dayId: string) => void;
}) {
  const { t } = useTranslation('plans');
  const toast = useToast();
  const units = useLiveQuery(
    () => (open ? listWorkoutUnitsWithExercises() : Promise.resolve([])),
    [open],
    [],
  );

  const addEmpty = async () => {
    const day = await addDay(planId);
    onDayAdded(day.id);
    toast.show(t('addDay.success'), 'success');
  };

  const importUnit = async (unitId: string) => {
    try {
      const day = await addWorkoutUnitToPlan(unitId, planId);
      onDayAdded(day.id);
      toast.show(t('addDay.importSuccess'), 'success');
    } catch {
      toast.show(t('addDay.importFailed'), 'error');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('addDay.title')}
      description={t('addDay.description')}
    >
      <div className="grid gap-4">
        <Button
          variant="primary"
          fullWidth
          className="justify-start"
          onClick={() => void addEmpty()}
        >
          <FilePlus2 size={18} aria-hidden="true" />
          {t('addDay.empty')}
        </Button>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Layers size={14} aria-hidden="true" />
            {t('addDay.fromLibrary')}
          </h3>
          {units.length === 0 ? (
            <p className="text-sm text-muted">{t('addDay.libraryEmpty')}</p>
          ) : (
            <ul className="grid gap-2">
              {units.map(({ unit, exercises }) => {
                const summary = summariseWorkoutUnit(exercises);
                return (
                  <li key={unit.id}>
                    <button
                      type="button"
                      onClick={() => void importUnit(unit.id)}
                      className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors active:bg-surface-3"
                    >
                      <p className="truncate font-medium">{unit.name}</p>
                      <p className="numeric text-xs text-muted">
                        {t(
                          summary.exerciseCount === 1
                            ? 'count.exerciseOne'
                            : 'count.exerciseOther',
                          { count: summary.exerciseCount },
                        )}{' '}
                        · {formatSets(summary.totalTargetSets)}
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
