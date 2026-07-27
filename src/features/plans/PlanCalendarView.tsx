import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { WEEKDAY_LABELS_SHORT } from '@/services/schedule';
import type { TrainingPlan, WorkoutSession } from '@/types';

const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

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

const STATUS_LEGEND: { status: PlanCalendarStatus; label: string }[] = [
  { status: 'completed', label: 'Abgeschlossen' },
  { status: 'planned', label: 'Geplant' },
  { status: 'rest', label: 'Pause' },
  { status: 'missed', label: 'Verpasst' },
  { status: 'skipped', label: 'Übersprungen' },
  { status: 'moved', label: 'Verschoben' },
];

const STATUS_TEXT: Record<PlanCalendarStatus, string> = {
  completed: 'Abgeschlossenes Training',
  planned: 'Geplantes Training',
  missed: 'Geplant, aber nicht absolviert',
  rest: 'Pausentag',
  skipped: 'Übersprungen',
  moved: 'Auf ein anderes Datum verschoben',
  free: 'Kein Training geplant',
};

/** yyyy-MM-dd → DD.MM.YYYY for display. */
function readableDate(iso: string): string {
  return iso.split('-').reverse().join('.');
}

async function completedSessionsOfPlan(planId: string): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions.where('status').equals('completed').toArray();
  return sessions.filter((session) => session.planId === planId);
}

/** A month calendar of planned vs. actual plan days with per-day exceptions (Phase 4). */
export function PlanCalendarView({ plan }: { plan: TrainingPlan }) {
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

  if (!view) return <p className="text-sm text-muted">Wird geladen …</p>;

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
      toast.show('Ausnahme entfernt.', 'info');
      return;
    }
    await setPlanException(plan.id, day.date, type);
    toast.show(
      type === 'skip' ? 'Als übersprungen markiert.' : 'Zusätzlicher Pausentag gesetzt.',
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
      toast.show(`Training auf ${readableDate(target)} verschoben.`, 'success');
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Verschieben fehlgeschlagen.',
        'error',
      );
    }
  };

  // Pad the grid so the first cell lands under its weekday column (Mon-based).
  const leadingBlanks = days.length > 0 ? days[0].weekday : 0;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <IconButton
          label="Vorheriger Monat"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <p className="text-sm font-semibold">
          {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
        </p>
        <IconButton
          label="Nächster Monat"
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
        {WEEKDAY_LABELS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const className = `flex min-h-[40px] flex-col items-center justify-center rounded-lg p-1 text-center ${
            STATUS_STYLE[day.status]
          } ${day.isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`;
          const content = (
            <>
              <span className="text-xs font-semibold leading-none">{day.dayOfMonth}</span>
              {day.label ? (
                <span className="mt-0.5 line-clamp-1 w-full truncate text-[9px] leading-tight">
                  {day.label}
                </span>
              ) : null}
            </>
          );
          // A completed day reflects a real workout — no exception applies to it.
          if (!interactive || day.status === 'completed') {
            return (
              <div
                key={day.date}
                title={day.label ? `${day.date}: ${day.label}` : day.date}
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
              aria-label={`${readableDate(day.date)} – ${STATUS_TEXT[day.status]}`}
              className={className}
              onClick={() => setSelected(day)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {STATUS_LEGEND.map(({ status, label }) => (
          <li key={status} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${STATUS_STYLE[status]}`} />
            {label}
          </li>
        ))}
      </ul>

      {view.schedule.mode === 'free-rotation' ? (
        <p className="text-xs text-muted">
          Freie Rotation ist nicht an Kalendertage gebunden — der Kalender zeigt hier nur
          die tatsächlich absolvierten Trainings.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Tippe auf einen Tag, um ein Training zu überspringen oder einen zusätzlichen
          Pausentag einzutragen.
        </p>
      )}

      <Dialog
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? readableDate(selected.date) : ''}
        description={selected ? STATUS_TEXT[selected.status] : undefined}
        footer={
          selected ? (
            <>
              {hasException.has(selected.date) ? (
                <Button
                  variant="secondary"
                  onClick={() => void applyException(selected, 'clear')}
                >
                  <Undo2 size={16} aria-hidden="true" />
                  Ausnahme entfernen
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
                  Übersprungen
                </Button>
              ) : null}
              {selected.status === 'planned' || selected.status === 'missed' ? (
                <Button variant="secondary" onClick={() => startMove(selected)}>
                  <CalendarClock size={16} aria-hidden="true" />
                  Verschieben
                </Button>
              ) : null}
              {selected.status !== 'rest' ? (
                <Button
                  variant="primary"
                  onClick={() => void applyException(selected, 'rest')}
                >
                  <Coffee size={16} aria-hidden="true" />
                  Zusätzliche Pause
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <p className="text-sm text-muted">
          Der Zeitplan bleibt unverändert — die Ausnahme betrifft nur diesen Tag. Ein
          übersprungenes Training zählt nicht als „verpasst".
        </p>
      </Dialog>

      <Dialog
        open={moveFor != null}
        onClose={() => setMoveFor(null)}
        title="Training verschieben"
        description={
          moveFor
            ? `„${moveFor.label ?? 'Training'}" vom ${readableDate(moveFor.date)} auf ein anderes Datum legen.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveFor(null)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={!moveTarget || moveTarget === moveFor?.date}
              onClick={() => void confirmMove()}
            >
              <CalendarClock size={16} aria-hidden="true" />
              Verschieben
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Neues Datum</span>
          <input
            type="date"
            value={moveTarget}
            onChange={(event) => setMoveTarget(event.target.value)}
            className="min-h-[44px] rounded-xl border border-border bg-surface px-3 text-text"
          />
        </label>
        {moveTarget && moveTarget !== moveFor?.date ? (
          <p className="mt-3 text-sm text-muted">
            „{moveFor?.label ?? 'Training'}" erscheint dann am {readableDate(moveTarget)};
            der {readableDate(moveFor?.date ?? '')} wird als verschoben markiert.
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
