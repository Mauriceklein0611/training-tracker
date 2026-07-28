import { useMemo, useState } from 'react';
import { addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  buildCalendarCells,
  dayColorKind,
  INTENSITY_METRIC_LABELS,
  type DayActivity,
  type DayColorKind,
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

/** The base colour token for each day kind (strength = cyan, cardio = green …). */
const KIND_COLOR: Record<Exclude<DayColorKind, 'none' | 'mixed'>, string> = {
  strength: 'var(--accent)',
  cardio: 'var(--cardio)',
  deload: 'var(--warning)',
  body: 'var(--body)',
};

const KIND_LABEL: Record<Exclude<DayColorKind, 'none'>, string> = {
  strength: 'Kraft',
  cardio: 'Cardio',
  mixed: 'Kraft + Cardio',
  deload: 'Deload',
  body: 'Körpermessung',
};

/**
 * Background for a day, coloured by its kind and shaded by the chosen metric's
 * intensity. A mixed day blends the strength and cardio hues so both read at a
 * glance; a body-only day uses a fixed light violet. Colour is never the only
 * signal — every cell has a text label with the day's figures.
 */
function dayBackground(kind: DayColorKind, level: IntensityLevel): string {
  if (kind === 'none') return 'var(--surface-2)';
  if (kind === 'body') {
    return `color-mix(in oklab, var(--body) 45%, var(--surface-2))`;
  }
  const percent = [20, 20, 40, 65, 90][level];
  if (kind === 'mixed') {
    return `linear-gradient(135deg, color-mix(in oklab, var(--accent) ${percent}%, var(--surface-2)), color-mix(in oklab, var(--cardio) ${percent}%, var(--surface-2)))`;
  }
  return `color-mix(in oklab, ${KIND_COLOR[kind]} ${percent}%, var(--surface-2))`;
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
  bodyDays,
  selectedDay,
  onSelectDay,
  now = new Date(),
}: {
  activity: Map<string, DayActivity>;
  /** Local day keys that carry a body measurement — coloured violet when idle. */
  bodyDays?: Set<string>;
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
          const hasBody = bodyDays?.has(cell.day) ?? false;
          const kind = dayColorKind(cell.activity, hasBody);
          const isSelected = selectedDay === cell.day;
          const label = hasTraining
            ? `${formatDate(cell.date)}: ${metricSummary(cell.activity as DayActivity, metric)}${
                cell.activity!.isDeload ? ' · Deload' : ''
              }`
            : hasBody
              ? `${formatDate(cell.date)}: Körpermessung`
              : `${formatDate(cell.date)}: kein Training`;

          const baseClass =
            'flex min-h-[44px] items-center justify-center rounded-lg text-sm tabular-nums transition-colors';

          // A body-only day (no session to reveal) is a coloured, non-interactive
          // cell; a truly empty day stays plain.
          if (!hasTraining) {
            return (
              <div
                key={cell.day}
                aria-hidden={!cell.inMonth && !hasBody}
                title={hasBody ? label : undefined}
                style={{ background: hasBody ? dayBackground('body', 0) : undefined }}
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
              style={{ background: dayBackground(kind, cell.level) }}
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

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {(['strength', 'cardio', 'mixed', 'deload', 'body'] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-sm border border-border"
              style={{ background: dayBackground(kind, 4) }}
            />
            {KIND_LABEL[kind]}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Farbe = Art des Tages, Sättigung = {INTENSITY_METRIC_LABELS[metric]} pro Tag.
        Ruhetage bleiben grau.
      </p>
    </section>
  );
}
