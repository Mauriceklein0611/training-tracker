import { Segmented } from '@/components/ui/Field';
import { setWorkoutUnitGroupOptions } from '@/db/repositories/workoutUnits';
import { GROUP_TYPE_LABELS } from '@/services/grouping';
import type { GroupRestMode, GroupType } from '@/types';

/**
 * Group header for the library unit editor. Mirrors {@link TemplateGroupHeader}
 * but writes to the workout-unit repository.
 */
export function WorkoutUnitGroupHeader({
  unitId,
  groupId,
  letter,
  groupType,
  groupRestMode,
  memberCount,
}: {
  unitId: string;
  groupId: string;
  letter: string;
  groupType: GroupType;
  groupRestMode: GroupRestMode;
  memberCount: number;
}) {
  return (
    <div className="mb-2 grid gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-accent px-2 text-sm font-bold text-accent-contrast">
          {letter}
        </span>
        <span className="text-sm font-semibold">
          {GROUP_TYPE_LABELS[groupType]} · {memberCount} Übungen
        </span>
      </div>
      <Segmented
        label="Gruppentyp"
        value={groupType}
        onChange={(value) =>
          void setWorkoutUnitGroupOptions(unitId, groupId, {
            groupType: value as GroupType,
          })
        }
        options={[
          { value: 'superset', label: 'Supersatz' },
          { value: 'circuit', label: 'Zirkel' },
        ]}
      />
      <Segmented
        label="Pause"
        value={groupRestMode}
        onChange={(value) =>
          void setWorkoutUnitGroupOptions(unitId, groupId, {
            groupRestMode: value as GroupRestMode,
          })
        }
        options={[
          { value: 'round', label: 'Nach jeder Runde' },
          { value: 'each', label: 'Nach jeder Übung' },
        ]}
      />
    </div>
  );
}
