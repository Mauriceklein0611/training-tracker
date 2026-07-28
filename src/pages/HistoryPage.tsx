import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, X } from 'lucide-react';
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
import { aggregateVolume } from '@/services/metrics';
import {
  dayKey,
  formatDate,
  formatDayHeading,
  formatDurationLong,
  formatTime,
} from '@/utils/date';
import { formatNumber, formatVolume } from '@/utils/format';

interface HistoryRow {
  id: string;
  name: string;
  startedAt: string;
  day: string;
  durationSeconds: number | null;
  workingSets: number;
  volumeKg: number;
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

export default function HistoryPage() {
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
            workingSets: totals.setCount,
            volumeKg: totals.volumeKg,
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
      <PageHeader title="Verlauf" subtitle={`${rows.length} abgeschlossene Einheiten`} />

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
          label="Suchen"
          type="search"
          value={search}
          placeholder="Training, Übung oder Notiz"
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Zeitraum"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="all">Gesamter Zeitraum</option>
          <option value="7">Letzte 7 Tage</option>
          <option value="30">Letzte 30 Tage</option>
          <option value="90">Letzte 90 Tage</option>
        </SelectField>
      </div>

      {selectedDay ? (
        <button
          type="button"
          onClick={() => setSelectedDay(null)}
          className="mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-accent/40 bg-surface-2 px-3 text-sm font-medium text-accent"
        >
          <span>Ausgewählter Tag: {formatDate(selectedDay)}</span>
          <X size={16} aria-hidden="true" />
          <span className="sr-only">Auswahl aufheben</span>
        </button>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={<History size={28} aria-hidden="true" />}
          title={
            rows.length === 0 ? 'Noch keine abgeschlossenen Trainings' : 'Keine Treffer'
          }
          description={
            rows.length === 0
              ? 'Sobald du eine Trainingseinheit beendest, erscheint sie hier — mit allen Sätzen, Pausen und Notizen. Du kannst Einheiten später korrigieren oder als Vorlage für ein neues Training verwenden.'
              : selectedDay
                ? 'An diesem Tag gibt es keine Einheit, die zu Suche und Zeitraum passt.'
                : 'Passe Suche oder Zeitraum an.'
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
                {entries.map((row) => (
                  <li key={row.id}>
                    <Link
                      to={`/verlauf/${row.id}`}
                      className="block rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{row.name}</p>
                        <span className="numeric shrink-0 text-sm text-muted">
                          {formatTime(row.startedAt)}
                        </span>
                      </div>
                      <p className="numeric mt-1 text-sm text-muted">
                        {row.durationSeconds != null
                          ? `${formatDurationLong(row.durationSeconds)} · `
                          : ''}
                        {formatNumber(row.workingSets)} Sätze
                        {row.volumeKg > 0 ? ` · ${formatVolume(row.volumeKg)}` : ''}
                      </p>
                      {row.exerciseNames.length > 0 ? (
                        <p className="mt-1 truncate text-xs text-muted">
                          {row.exerciseNames.join(', ')}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
