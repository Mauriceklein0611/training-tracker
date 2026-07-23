import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/db/db';
import { IconButton } from '@/components/ui/Button';
import { getPlanScheduleView } from '@/db/repositories/schedules';
import { buildPlanCalendarMonth, type PlanCalendarStatus } from '@/services/planCalendar';
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
  free: 'text-muted/60',
};

const STATUS_LEGEND: { status: PlanCalendarStatus; label: string }[] = [
  { status: 'completed', label: 'Abgeschlossen' },
  { status: 'planned', label: 'Geplant' },
  { status: 'rest', label: 'Pause' },
  { status: 'missed', label: 'Verpasst' },
];

async function completedSessionsOfPlan(planId: string): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions.where('status').equals('completed').toArray();
  return sessions.filter((session) => session.planId === planId);
}

/** A read-only month calendar of planned vs. actual plan days (Phase 4). */
export function PlanCalendarView({ plan }: { plan: TrainingPlan }) {
  const [month, setMonth] = useState(() => new Date());
  const view = useLiveQuery(() => getPlanScheduleView(plan.id), [plan.id]);
  const sessions = useLiveQuery(() => completedSessionsOfPlan(plan.id), [plan.id], []);

  const days = useMemo(() => {
    if (!view) return [];
    return buildPlanCalendarMonth({
      schedule: view.schedule,
      entries: view.entries,
      units: view.units,
      sessions,
      month,
      anchorDate: view.schedule.startDate ?? plan.startDate,
    });
  }, [view, sessions, month, plan.startDate]);

  if (!view) return <p className="text-sm text-muted">Wird geladen …</p>;

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
        {days.map((day) => (
          <div
            key={day.date}
            title={day.label ? `${day.date}: ${day.label}` : day.date}
            className={`flex min-h-[40px] flex-col items-center justify-center rounded-lg p-1 text-center ${
              STATUS_STYLE[day.status]
            } ${day.isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`}
          >
            <span className="text-xs font-semibold leading-none">{day.dayOfMonth}</span>
            {day.label ? (
              <span className="mt-0.5 line-clamp-1 w-full truncate text-[9px] leading-tight">
                {day.label}
              </span>
            ) : null}
          </div>
        ))}
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
      ) : null}
    </div>
  );
}
