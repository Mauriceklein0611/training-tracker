import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, Dumbbell, History, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { CalendarHeatmap } from '@/features/history/CalendarHeatmap';
import { WeeklyGoalsCard } from '@/features/history/WeeklyGoalsCard';
import { useSettings } from '@/hooks/useSettings';
import { loadAnalyticsDataset } from '@/services/dataset';
import { buildSetContexts, type AnalyticsDataset } from '@/services/analytics';
import { buildDayActivity, hasAnyWeeklyGoal } from '@/services/calendar';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { aggregateVolume, isCardio, isCompleted } from '@/services/metrics';
import {
  aggregateCardio,
  aggregatePace,
  formatCardioDistance,
  formatPace,
  type Pace,
} from '@/services/cardioMetrics';
import {
  dayKey,
  formatDate,
  formatDayHeading,
  formatDurationLong,
  formatTime,
} from '@/utils/date';
import { formatSections, formatSets, formatVolume } from '@/utils/format';

type SessionKind = 'strength' | 'cardio' | 'mixed';

interface HistoryRow {
  id: string;
  name: string;
  startedAt: string;
  day: string;
  durationSeconds: number | null;
  kind: SessionKind;
  workingSets: number;
  volumeKg: number;
  cardioSections: number;
  cardioDistanceMeters: number;
  cardioPace: Pace | null;
  exerciseNames: string[];
  notes: string;
}

interface HistoryData {
  rows: HistoryRow[];
  dataset: AnalyticsDataset;
  /** Local day keys carrying a body measurement, for the calendar's violet days. */
  bodyDays: string[];
}

const EMPTY_DATA: HistoryData = {
  rows: [],
  dataset: { sessions: [], sessionExercises: [], sets: [], exercises: [] },
  bodyDays: [],
};

const KIND_STYLE: Record<SessionKind, { Icon: typeof Dumbbell; color: string }> = {
  strength: { Icon: Dumbbell, color: 'var(--accent)' },
  cardio: { Icon: Activity, color: 'var(--cardio)' },
  mixed: { Icon: Dumbbell, color: 'var(--accent)' },
};

/** The headline metric line — strength uses Sätze/Volumen, cardio uses
 * Abschnitte/Distanz/Pace, so a run never reads as "0 Sätze". */
function primaryMetrics(row: HistoryRow): string {
  const parts: string[] = [];
  if (row.durationSeconds != null) parts.push(formatDurationLong(row.durationSeconds));
  if (row.kind === 'cardio') {
    parts.push(formatSections(row.cardioSections));
    if (row.cardioDistanceMeters > 0) {
      parts.push(formatCardioDistance(row.cardioDistanceMeters, undefined));
    }
    if (row.cardioPace) parts.push(formatPace(row.cardioPace));
  } else {
    parts.push(formatSets(row.workingSets));
    if (row.volumeKg > 0) parts.push(formatVolume(row.volumeKg));
  }
  return parts.join(' · ');
}

/** Second line for a mixed session: its cardio side, kept in cardio terms. */
function cardioMetrics(row: HistoryRow): string | null {
  if (row.kind !== 'mixed') return null;
  const parts = [formatSections(row.cardioSections)];
  if (row.cardioDistanceMeters > 0) {
    parts.push(formatCardioDistance(row.cardioDistanceMeters, undefined));
  }
  if (row.cardioPace) parts.push(formatPace(row.cardioPace));
  return parts.join(' · ');
}

export default function HistoryPage() {
  const { t } = useTranslation('history');
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const data = useLiveQuery(
    async (): Promise<HistoryData> => {
      const dataset = await loadAnalyticsDataset();
      const contexts = buildSetContexts(dataset);
      const bodyDays = (await listBodyWeightEntries()).map((entry) => entry.date);

      const rows = dataset.sessions
        .filter((session) => session.status === 'completed')
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((session) => {
          const own = contexts.filter((context) => context.session.id === session.id);
          const totals = aggregateVolume(
            own.map(({ set, sessionExercise }) => ({ set, sessionExercise })),
          );
          const cardioTotals = aggregateCardio(
            own.map(({ set, sessionExercise }) => ({ set, context: sessionExercise })),
          );
          const hasStrength = own.some(
            ({ set, sessionExercise }) =>
              isCompleted(set) && !isCardio(set, sessionExercise),
          );
          const hasCardio = cardioTotals.activities > 0;
          const kind: SessionKind =
            hasStrength && hasCardio ? 'mixed' : hasCardio ? 'cardio' : 'strength';
          // A single, shared modality lets us show an aggregate pace; mixed
          // modalities (e.g. run + row) have no common pace, so we omit it.
          const modalities = new Set(
            own
              .filter(({ set, sessionExercise }) => isCardio(set, sessionExercise))
              .map(({ sessionExercise }) => sessionExercise.cardioModalitySnapshot)
              .filter((value): value is NonNullable<typeof value> => value != null),
          );
          const singleModality = modalities.size === 1 ? [...modalities][0] : undefined;
          return {
            id: session.id,
            name: session.name,
            startedAt: session.startedAt,
            day: dayKey(session.startedAt),
            durationSeconds: session.finishedAt
              ? (new Date(session.finishedAt).getTime() -
                  new Date(session.startedAt).getTime()) /
                1000
              : null,
            kind,
            workingSets: totals.setCount,
            volumeKg: totals.volumeKg,
            cardioSections: cardioTotals.activities,
            cardioDistanceMeters: cardioTotals.totalDistanceMeters,
            cardioPace: aggregatePace(
              singleModality,
              cardioTotals.totalDurationSeconds,
              cardioTotals.totalDistanceMeters,
            ),
            exerciseNames: [
              ...new Set(
                own.map((context) => context.sessionExercise.exerciseNameSnapshot),
              ),
            ],
            notes: session.notes,
          };
        });

      return { rows, dataset, bodyDays };
    },
    [],
    EMPTY_DATA,
  );

  const { rows, dataset } = data;

  const activity = useMemo(() => buildDayActivity(dataset), [dataset]);
  const bodyDays = useMemo(() => new Set(data.bodyDays), [data.bodyDays]);
  const showGoals = hasAnyWeeklyGoal(settings.weeklyGoals);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff =
      period === 'all' ? null : Date.now() - Number(period) * 24 * 3600 * 1000;

    return rows.filter((row) => {
      if (selectedDay && row.day !== selectedDay) return false;
      if (cutoff != null && new Date(row.startedAt).getTime() < cutoff) return false;
      if (!term) return true;
      return [row.name, row.notes, ...row.exerciseNames]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [rows, search, period, selectedDay]);

  // Group by calendar day so the list reads like a diary.
  const groups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const row of filtered) {
      const list = map.get(row.day) ?? [];
      list.push(row);
      map.set(row.day, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('completedCount', { count: rows.length })}
      />

      {rows.length > 0 ? (
        <div className="mb-4 grid gap-4">
          <CalendarHeatmap
            activity={activity}
            bodyDays={bodyDays}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {showGoals ? (
            <WeeklyGoalsCard dataset={dataset} goals={settings.weeklyGoals ?? {}} />
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3">
        <TextField
          label={t('search.label')}
          type="search"
          value={search}
          placeholder={t('search.placeholder')}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label={t('period.label')}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="all">{t('period.all')}</option>
          <option value="7">{t('period.days7')}</option>
          <option value="30">{t('period.days30')}</option>
          <option value="90">{t('period.days90')}</option>
        </SelectField>
      </div>

      {selectedDay ? (
        <button
          type="button"
          onClick={() => setSelectedDay(null)}
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-accent/40 bg-surface-2 px-3 text-sm font-medium text-accent"
        >
          <span>{t('selectedDay', { date: formatDate(selectedDay) })}</span>
          <X size={16} aria-hidden="true" />
          <span className="sr-only">{t('clearSelection')}</span>
        </button>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={<History size={28} aria-hidden="true" />}
          title={rows.length === 0 ? t('empty.noWorkouts') : t('empty.noResults')}
          description={
            rows.length === 0
              ? t('empty.firstWorkout')
              : selectedDay
                ? t('empty.selectedDay')
                : t('empty.filters')
          }
        />
      ) : (
        <div className="grid gap-5">
          {groups.map(([day, entries]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
              >
                {formatDayHeading(day)}
              </h2>
              <ul className="grid gap-2">
                {entries.map((row) => {
                  const meta = KIND_STYLE[row.kind];
                  const cardioLine = cardioMetrics(row);
                  return (
                    <li key={row.id}>
                      <Link
                        to={`/verlauf/${row.id}`}
                        className="flex gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
                      >
                        {/* Type signal: a tinted icon on the left, plus a text label
                         * in the exercise line, so meaning never rests on colour. */}
                        <span
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            color: meta.color,
                            background: `color-mix(in oklab, ${meta.color} 15%, transparent)`,
                          }}
                          aria-hidden="true"
                        >
                          <meta.Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="min-w-0 truncate font-medium">{row.name}</p>
                            <span className="numeric shrink-0 text-sm text-muted">
                              {formatTime(row.startedAt)}
                            </span>
                          </div>
                          <p className="numeric mt-1 text-sm text-muted">
                            {primaryMetrics(row)}
                          </p>
                          {cardioLine ? (
                            <p
                              className="numeric mt-0.5 text-xs"
                              style={{ color: 'var(--cardio)' }}
                            >
                              {cardioLine}
                            </p>
                          ) : null}
                          {row.exerciseNames.length > 0 ? (
                            <p className="mt-1 truncate text-xs text-muted">
                              <span className="sr-only">{t(`kind.${row.kind}`)}: </span>
                              {row.exerciseNames.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
