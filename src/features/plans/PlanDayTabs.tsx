import { ArrowRight, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkoutTemplate } from '@/types';
import { cn } from '@/utils/cn';
import type { PlanUnitProgressStatus } from '@/db/repositories/schedules';

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
  statusById,
}: {
  days: WorkoutTemplate[];
  activeDayId: string;
  onSelect: (dayId: string) => void;
  onAdd: () => void;
  statusById?: Map<string, PlanUnitProgressStatus>;
}) {
  const { t } = useTranslation('plans');
  const activeIndex = Math.max(
    0,
    days.findIndex((day) => day.id === activeDayId),
  );
  return (
    <div className="mb-4 min-w-0 max-w-full">
      <div className="grid gap-2 sm:hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {t('days.position', { current: activeIndex + 1, total: days.length })}
        </p>
        <select
          aria-label={t('days.aria')}
          value={activeDayId}
          onChange={(event) => onSelect(event.target.value)}
          className="min-h-[48px] w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-base font-medium"
        >
          {days.map((day) => (
            <option key={day.id} value={day.id}>
              {statusById?.get(day.id) === 'completed'
                ? `✓ ${day.name}`
                : statusById?.get(day.id) === 'next'
                  ? `→ ${day.name}`
                  : day.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => onSelect(days[activeIndex - 1].id)}
            className="inline-flex min-h-[44px] min-w-0 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-2 text-sm disabled:opacity-40"
          >
            <ChevronLeft size={18} aria-hidden="true" />
            <span className="truncate">{t('days.previous')}</span>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-[44px] min-w-0 items-center justify-center gap-1 rounded-xl border border-dashed border-border px-2 text-sm text-muted"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="truncate">{t('days.addShort')}</span>
          </button>
          <button
            type="button"
            disabled={activeIndex === days.length - 1}
            onClick={() => onSelect(days[activeIndex + 1].id)}
            className="inline-flex min-h-[44px] min-w-0 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-2 text-sm disabled:opacity-40"
          >
            <span className="truncate">{t('days.next')}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('days.aria')}
        className="hidden max-w-full gap-2 overflow-x-auto pb-1 sm:flex"
      >
        {days.map((day) => {
          const active = day.id === activeDayId;
          const status = statusById?.get(day.id);
          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(day.id)}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors',
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface text-muted',
              )}
            >
              {status === 'completed' ? (
                <Check size={14} aria-hidden="true" />
              ) : status === 'next' ? (
                <ArrowRight size={14} aria-hidden="true" />
              ) : null}
              {day.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('days.add')}
          className="flex min-h-[44px] w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted active:bg-surface-2"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
