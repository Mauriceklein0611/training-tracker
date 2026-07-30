import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { addMonths } from 'date-fns';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coffee,
  SkipForward,
  Undo2,
} from 'lucide-react';
import { db } from '@/db/db';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getPlanScheduleView } from '@/db/repositories/schedules';
import {
  clearPlanException,
  listPlanExceptions,
  setPlanException,
} from '@/db/repositories/planExceptions';
import { useToast } from '@/hooks/useToast';
import {
  buildPlanCalendarMonth,
  type PlanCalendarDay,
  type PlanCalendarStatus,
} from '@/services/planCalendar';
import type { TrainingPlan, WorkoutSession } from '@/types';
import { formatDate, formatMonthTitle } from '@/utils/date';

/** Cell colour per status — deliberately calm; a missed day is not punished. */
const STATUS_STYLE: Record<PlanCalendarStatus, string> = {
  completed: 'bg-accent text-accent-contrast',
  planned: 'border border-accent/50 text-accent',
  missed: 'border border-border text-muted',
  rest: 'bg-surface-2 text-muted',
  skipped: 'border border-dashed border-border text-muted/70',
  moved: 'border border-dashed border-accent/50 text-accent/80',
  free: 'text-muted/60',
};

const STATUS_LEGEND = [
  'completed',
  'planned',
  'rest',
  'missed',
  'skipped',
  'moved',
] as const satisfies readonly PlanCalendarStatus[];

async function completedSessionsOfPlan(planId: string): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions.where('status').equals('completed').toArray();
  return sessions.filter((session) => session.planId === planId);
}

/** A month calendar of planned vs. actual plan days with per-day exceptions (Phase 4). */
export function PlanCalendarView({ plan }: { plan: TrainingPlan }) {
  const { t } = useTranslation('plans');
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<PlanCalendarDay | null>(null);
  const [moveFor, setMoveFor] = useState<PlanCalendarDay | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const view = useLiveQuery(() => getPlanScheduleView(plan.id), [plan.id]);
  const sessions = useLiveQuery(() => completedSessionsOfPlan(plan.id), [plan.id], []);
  const exceptions = useLiveQuery(() => listPlanExceptions(plan.id), [plan.id], []);

  const days = useMemo(() => {
    if (!view) return [];
    return buildPlanCalendarMonth({
      schedule: view.schedule,
      entries: view.entries,
      units: view.units,
      sessions,
      exceptions,
      month,
      anchorDate: view.schedule.startDate ?? plan.startDate,
    });
  }, [view, sessions, exceptions, month, plan.startDate]);

  if (!view) return <p className="text-sm text-muted">{t('calendar.loading')}</p>;

  // Exceptions are date-bound overlays, so they only apply to the date-bound
  // modes; free rotation has no calendar plan to make an exception to.
  const interactive = view.schedule.mode !== 'free-rotation';
  const hasException = new Set(exceptions.map((exception) => exception.date));

  const applyException = async (
    day: PlanCalendarDay,
    type: 'skip' | 'rest' | 'clear',
  ) => {
    setSelected(null);
    if (type === 'clear') {
      await clearPlanException(plan.id, day.date);
      toast.show(t('calendar.exceptionRemoved'), 'info');
      return;
    }
    await setPlanException(plan.id, day.date, type);
    toast.show(
      type === 'skip' ? t('calendar.markedSkipped') : t('calendar.restAdded'),
      'success',
    );
  };

  const startMove = (day: PlanCalendarDay) => {
    setSelected(null);
    setMoveTarget('');
    setMoveFor(day);
  };

  const confirmMove = async () => {
    if (!moveFor || !moveTarget || moveTarget === moveFor.date) return;
    const target = moveTarget;
    const source = moveFor;
    setMoveFor(null);
    setMoveTarget('');
    try {
      await setPlanException(plan.id, source.date, 'move', { movedToDate: target });
      toast.show(t('calendar.movedSuccess', { date: formatDate(target) }), 'success');
    } catch {
      toast.show(t('calendar.moveFailed'), 'error');
    }
  };

  // Pad the grid so the first cell lands under its weekday column (Mon-based).
  const leadingBlanks = days.length > 0 ? days[0].weekday : 0;
  const weekdays = t('calendar.weekdaysShort', { returnObjects: true }) as string[];
  const statusDescription = (status: PlanCalendarStatus) =>
    t(`calendar.statusDescription.${status}`);
  const displayDayLabel = (day: PlanCalendarDay): string | undefined => {
    if (!day.label) return undefined;
    if (day.label === 'Pause') return t('calendar.fallbackLabel.rest');
    if (day.label === 'Entfernte Einheit') return t('calendar.fallbackLabel.removedUnit');
    if (day.label === 'Verschoben') return t('calendar.fallbackLabel.moved');
    if (day.label === 'Übersprungen') return t('calendar.fallbackLabel.skipped');
    if (day.label === 'Training') return t('calendar.fallbackLabel.training');
    return day.label;
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <IconButton
          label={t('calendar.previousMonth')}
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <p className="text-sm font-semibold capitalize">{formatMonthTitle(month)}</p>
        <IconButton
          label={t('calendar.nextMonth')}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {weekdays.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const displayLabel = displayDayLabel(day);
          const className = `flex min-h-[40px] flex-col items-center justify-center rounded-lg p-1 text-center ${
            STATUS_STYLE[day.status]
          } ${day.isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`;
          const content = (
            <>
              <span className="text-xs font-semibold leading-none">{day.dayOfMonth}</span>
              {displayLabel ? (
                <span className="mt-0.5 line-clamp-1 w-full truncate text-[9px] leading-tight">
                  {displayLabel}
                </span>
              ) : null}
            </>
          );
          // A completed day reflects a real workout — no exception applies to it.
          if (!interactive || day.status === 'completed') {
            return (
              <div
                key={day.date}
                title={
                  displayLabel
                    ? `${formatDate(day.date)}: ${displayLabel}`
                    : formatDate(day.date)
                }
                className={className}
              >
                {content}
              </div>
            );
          }
          return (
            <button
              key={day.date}
              type="button"
              aria-label={`${formatDate(day.date)} – ${statusDescription(day.status)}`}
              className={className}
              onClick={() => setSelected(day)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {STATUS_LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${STATUS_STYLE[status]}`} />
            {t(`calendar.status.${status}`)}
          </li>
        ))}
      </ul>

      {view.schedule.mode === 'free-rotation' ? (
        <p className="text-xs text-muted">{t('calendar.freeRotationHint')}</p>
      ) : (
        <p className="text-xs text-muted">{t('calendar.interactionHint')}</p>
      )}

      <Dialog
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? formatDate(selected.date) : ''}
        description={selected ? statusDescription(selected.status) : undefined}
        footer={
          selected ? (
            <>
              {hasException.has(selected.date) ? (
                <Button
                  variant="secondary"
                  onClick={() => void applyException(selected, 'clear')}
                >
                  <Undo2 size={16} aria-hidden="true" />
                  {t('calendar.removeException')}
                </Button>
              ) : null}
              {selected.status === 'planned' ||
              selected.status === 'missed' ||
              selected.status === 'skipped' ? (
                <Button
                  variant="secondary"
                  onClick={() => void applyException(selected, 'skip')}
                >
                  <SkipForward size={16} aria-hidden="true" />
                  {t('calendar.markSkipped')}
                </Button>
              ) : null}
              {selected.status === 'planned' || selected.status === 'missed' ? (
                <Button variant="secondary" onClick={() => startMove(selected)}>
                  <CalendarClock size={16} aria-hidden="true" />
                  {t('calendar.move')}
                </Button>
              ) : null}
              {selected.status !== 'rest' ? (
                <Button
                  variant="primary"
                  onClick={() => void applyException(selected, 'rest')}
                >
                  <Coffee size={16} aria-hidden="true" />
                  {t('calendar.addRest')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <p className="text-sm text-muted">{t('calendar.exceptionHint')}</p>
      </Dialog>

      <Dialog
        open={moveFor != null}
        onClose={() => setMoveFor(null)}
        title={t('calendar.moveTitle')}
        description={
          moveFor
            ? t('calendar.moveDescription', {
                name: displayDayLabel(moveFor) ?? t('calendar.fallbackLabel.training'),
                date: formatDate(moveFor.date),
              })
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveFor(null)}>
              {t('calendar.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!moveTarget || moveTarget === moveFor?.date}
              onClick={() => void confirmMove()}
            >
              <CalendarClock size={16} aria-hidden="true" />
              {t('calendar.move')}
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t('calendar.newDate')}</span>
          <input
            type="date"
            value={moveTarget}
            onChange={(event) => setMoveTarget(event.target.value)}
            className="min-h-[44px] rounded-xl border border-border bg-surface px-3 text-text"
          />
        </label>
        {moveTarget && moveTarget !== moveFor?.date ? (
          <p className="mt-3 text-sm text-muted">
            {t('calendar.movePreview', {
              name: moveFor
                ? (displayDayLabel(moveFor) ?? t('calendar.fallbackLabel.training'))
                : t('calendar.fallbackLabel.training'),
              target: formatDate(moveTarget),
              source: moveFor ? formatDate(moveFor.date) : '',
            })}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
