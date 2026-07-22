import { useMemo, useState } from 'react';
import { addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  buildCalendarCells,
  INTENSITY_METRIC_LABELS,
  type DayActivity,
  type IntensityLevel,
  type IntensityMetric,
} from '@/services/calendar';
import {
  formatDate,
  formatDurationLong,
  formatMonthTitle,
  monthGridDays,
} from '@/utils/date';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Background for an intensity level. Level 0 uses the plain surface so a rest
 * day is visibly empty; higher levels mix progressively more accent in, which
 * keeps a single hue (never colour-as-identity) and works on both themes.
 */
function levelBackground(level: IntensityLevel): string {
  if (level === 0) return 'var(--surface-2)';
  const percent = [0, 20, 40, 65, 90][level];
  return `color-mix(in oklab, var(--accent) ${percent}%, var(--surface-2))`;
}

function metricSummary(activity: DayActivity, metric: IntensityMetric): string {
  switch (metric) {
    case 'sessions':
      return `${activity.sessionCount} ${activity.sessionCount === 1 ? 'Einheit' : 'Einheiten'}`;
    case 'sets':
      return `${activity.workingSets} ${activity.workingSets === 1 ? 'Satz' : 'Sätze'}`;
    case 'duration':
      return formatDurationLong(activity.durationSeconds);
  }
}

/**
 * Compact month calendar with a training heatmap.
 *
 * Selecting a day that has training reports it upwards so the surrounding page
 * can reveal that day's workouts — the calendar never navigates on its own,
 * keeping the user in place.
 */
export function CalendarHeatmap({
  activity,
  selectedDay,
  onSelectDay,
  now = new Date(),
}: {
  activity: Map<string, DayActivity>;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  now?: Date;
}) {
  const [anchor, setAnchor] = useState(() => now);
  const [metric, setMetric] = useState<IntensityMetric>('sets');

  const cells = useMemo(
    () =>
      buildCalendarCells(monthGridDays(anchor), activity, metric, anchor.getMonth(), now),
    [anchor, activity, metric, now],
  );

  return (
    <section
      aria-label="Trainingskalender"
      className="rounded-2xl border border-border bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButton
          label="Vorheriger Monat"
          variant="secondary"
          onClick={() => setAnchor((current) => addMonths(current, -1))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <h3 className="text-sm font-semibold capitalize">{formatMonthTitle(anchor)}</h3>
        <IconButton
          label="Nächster Monat"
          variant="secondary"
          onClick={() => setAnchor((current) => addMonths(current, 1))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <Segmented
        label="Intensität anzeigen nach"
        className="mb-3"
        value={metric}
        onChange={setMetric}
        options={[
          { value: 'sets', label: INTENSITY_METRIC_LABELS.sets },
          { value: 'sessions', label: INTENSITY_METRIC_LABELS.sessions },
          { value: 'duration', label: INTENSITY_METRIC_LABELS.duration },
        ]}
      />

      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[11px] font-medium text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.flat().map((cell) => {
          const hasTraining = cell.activity != null;
          const isSelected = selectedDay === cell.day;
          const label = hasTraining
            ? `${formatDate(cell.date)}: ${metricSummary(cell.activity as DayActivity, metric)}`
            : `${formatDate(cell.date)}: kein Training`;

          const baseClass =
            'flex min-h-[44px] items-center justify-center rounded-lg text-sm tabular-nums transition-colors';
          const style = {
            backgroundColor: hasTraining ? levelBackground(cell.level) : undefined,
          };

          if (!hasTraining) {
            return (
              <div
                key={cell.day}
                aria-hidden={!cell.inMonth}
                className={`${baseClass} border border-transparent ${
                  cell.inMonth ? 'text-text' : 'text-muted/40'
                } ${cell.isToday ? 'ring-1 ring-accent' : ''}`}
              >
                {cell.dayOfMonth}
              </div>
            );
          }

          return (
            <button
              key={cell.day}
              type="button"
              aria-pressed={isSelected}
              aria-label={label}
              title={label}
              onClick={() => onSelectDay(isSelected ? null : cell.day)}
              style={style}
              className={`${baseClass} border font-semibold text-text active:opacity-80 ${
                isSelected ? 'border-accent ring-1 ring-accent' : 'border-transparent'
              } ${cell.isToday && !isSelected ? 'ring-1 ring-accent' : ''} ${
                !cell.inMonth ? 'opacity-60' : ''
              }`}
            >
              {cell.dayOfMonth}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted">
        <span>weniger</span>
        {([0, 1, 2, 3, 4] as IntensityLevel[]).map((level) => (
          <span
            key={level}
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm border border-border"
            style={{ backgroundColor: levelBackground(level) }}
          />
        ))}
        <span>mehr</span>
      </div>
      <p className="mt-1 text-right text-[11px] text-muted">
        Skala: {INTENSITY_METRIC_LABELS[metric]} pro Tag
      </p>
    </section>
  );
}
