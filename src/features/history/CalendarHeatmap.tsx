import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  buildCalendarCells,
  dayColorKind,
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

/** The base colour token for each day kind (strength = cyan, cardio = green …). */
const KIND_COLOR: Record<Exclude<DayColorKind, 'none' | 'mixed'>, string> = {
  strength: 'var(--accent)',
  cardio: 'var(--cardio)',
  deload: 'var(--warning)',
  body: 'var(--body)',
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
  const { t } = useTranslation('history');
  const [anchor, setAnchor] = useState(() => now);
  const [metric, setMetric] = useState<IntensityMetric>('sets');
  const weekdayLabels = t('calendar.weekdays', {
    returnObjects: true,
  }) as string[];
  const metricLabel = (value: IntensityMetric) => t(`calendar.metric.${value}`);
  const metricSummary = (value: DayActivity) => {
    if (metric === 'duration') return formatDurationLong(value.durationSeconds);
    if (metric === 'sessions') {
      return t(
        value.sessionCount === 1 ? 'calendar.sessionOne' : 'calendar.sessionOther',
        { count: value.sessionCount },
      );
    }
    return t(value.workingSets === 1 ? 'calendar.setOne' : 'calendar.setOther', {
      count: value.workingSets,
    });
  };

  const cells = useMemo(
    () =>
      buildCalendarCells(monthGridDays(anchor), activity, metric, anchor.getMonth(), now),
    [anchor, activity, metric, now],
  );

  return (
    <section
      aria-label={t('calendar.aria')}
      className="rounded-2xl border border-border bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButton
          label={t('calendar.previousMonth')}
          variant="secondary"
          onClick={() => setAnchor((current) => addMonths(current, -1))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </IconButton>
        <h3 className="text-sm font-semibold capitalize">{formatMonthTitle(anchor)}</h3>
        <IconButton
          label={t('calendar.nextMonth')}
          variant="secondary"
          onClick={() => setAnchor((current) => addMonths(current, 1))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </IconButton>
      </div>

      <Segmented
        label={t('calendar.intensityBy')}
        className="mb-3"
        value={metric}
        onChange={setMetric}
        options={[
          { value: 'sets', label: metricLabel('sets') },
          { value: 'sessions', label: metricLabel('sessions') },
          { value: 'duration', label: metricLabel('duration') },
        ]}
      />

      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {weekdayLabels.map((label) => (
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
            ? `${formatDate(cell.date)}: ${metricSummary(cell.activity as DayActivity)}${
                cell.activity!.isDeload ? ' · Deload' : ''
              }`
            : hasBody
              ? t('calendar.bodyDay', { date: formatDate(cell.date) })
              : t('calendar.noTraining', { date: formatDate(cell.date) });

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
            {t(`calendar.kind.${kind}`)}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {t('calendar.legend', { metric: metricLabel(metric) })}
      </p>
    </section>
  );
}
