import { Plus } from 'lucide-react';
import type { WorkoutTemplate } from '@/types';
import { cn } from '@/utils/cn';

/**
 * Horizontal, scrollable day navigation for the plan editor:
 * `[ Tag A ] [ Tag B ] [ + ]`. The active day is highlighted; the whole strip
 * scrolls sideways when the days do not fit, so it stays usable on a phone.
 */
export function PlanDayTabs({
  days,
  activeDayId,
  onSelect,
  onAdd,
}: {
  days: WorkoutTemplate[];
  activeDayId: string;
  onSelect: (dayId: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Trainingstage"
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {days.map((day) => {
        const active = day.id === activeDayId;
        return (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(day.id)}
            className={cn(
              'min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
              active
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-surface text-muted',
            )}
          >
            {day.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Trainingstag hinzufügen"
        className="flex min-h-[44px] w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted active:bg-surface-2"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
