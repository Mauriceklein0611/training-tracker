import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Copy,
  Dumbbell,
  ListOrdered,
  Moon,
  Plus,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { moveDay } from '@/db/repositories/plans';
import {
  addCycleEntry,
  deleteCycleEntry,
  duplicateCycleEntry,
  getPlanScheduleState,
  getPlanScheduleView,
  moveCycleEntry,
  resetCycle,
  setCyclePosition,
  setScheduleMode,
  setWeekdayAssignment,
  updateCycleEntry,
} from '@/db/repositories/schedules';
import { type ScheduleMode } from '@/types';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

const REST_ICON = <Moon size={15} aria-hidden="true" />;

/**
 * Editor for a plan's time layout: pick a mode and lay the plan's reusable
 * workout units out as a free rotation, a repeating cycle (with rest days) or a
 * weekly plan. Reads live so every edit is reflected immediately, including the
 * "coming up" preview.
 */
export function ScheduleEditor({ planId }: { planId: string }) {
  const { t } = useTranslation('plans');
  const view = useLiveQuery(() => getPlanScheduleView(planId), [planId]);
  const state = useLiveQuery(() => getPlanScheduleState(planId), [planId]);
  const [pendingMode, setPendingMode] = useState<ScheduleMode | null>(null);

  if (!view) {
    return (
      <p className="text-sm text-muted" role="status">
        {t('schedule.loading')}
      </p>
    );
  }

  const { schedule, entries, units } = view;
  const mode = schedule.mode;
  const hasUnitOptions = units.length > 0;

  const requestModeChange = (next: ScheduleMode) => {
    if (next === mode) return;
    // Switching reseeds entries; confirm only when there is work to lose.
    if (entries.length > 0) {
      setPendingMode(next);
      return;
    }
    void applyModeChange(next);
  };

  const applyModeChange = async (next: ScheduleMode) => {
    await setScheduleMode(planId, next);
    setPendingMode(null);
  };

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('schedule.modeLabel')}
        </p>
        <div
          role="radiogroup"
          aria-label={t('schedule.modeLabel')}
          className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {(
            [
              { value: 'free-rotation', icon: ListOrdered },
              { value: 'repeating-cycle', icon: Repeat2 },
              { value: 'weekly', icon: CalendarDays },
            ] as const
          ).map((option) => {
            const selected = option.value === mode;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => requestModeChange(option.value)}
                className={cn(
                  'flex min-h-[56px] min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  selected
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-surface-2 text-muted active:bg-surface-3',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                    selected ? 'bg-accent text-accent-contrast' : 'bg-surface text-muted',
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {t(`schedule.modes.${option.value}`)}
                </span>
                {selected ? (
                  <Check className="shrink-0 text-accent" size={18} aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
          {t(`schedule.modeDescriptions.${mode}`)}
        </p>
      </section>

      {/* Coming-up preview, shared by all modes. */}
      {state && state.upcoming.length > 0 ? (
        <section className="grid gap-2.5 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('schedule.upcoming')}
          </p>
          <ol className="grid min-w-0 grid-cols-2 gap-2">
            {state.upcoming.slice(0, 4).map((item, index) => (
              <li
                key={`${item.entry.id}-${index}`}
                className={cn(
                  'flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5',
                  index === 0
                    ? 'col-span-2 border-accent bg-accent/10'
                    : 'border-border bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                    index === 0
                      ? 'bg-accent text-accent-contrast'
                      : 'bg-surface text-muted',
                  )}
                >
                  {index + 1}
                </span>
                <span className={item.type === 'rest' ? 'text-muted' : 'text-accent'}>
                  {item.type === 'rest' ? REST_ICON : <Dumbbell size={15} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">
                  {item.type === 'rest'
                    ? item.entry.id.startsWith('weekday-')
                      ? t('schedule.free')
                      : item.name === 'Pause'
                        ? t('schedule.rest')
                        : item.name
                    : item.template
                      ? item.name
                      : t('schedule.removedUnit')}
                </span>
                {index === 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-accent-contrast">
                    {t('schedule.nextBadge')}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="min-w-0 border-t border-border pt-4">
        {mode === 'free-rotation' ? <FreeRotationBody units={units} /> : null}
        {mode === 'repeating-cycle' ? (
          <CycleBody
            planId={planId}
            units={units}
            entries={entries}
            cursor={schedule.cyclePosition ?? 0}
            hasUnitOptions={hasUnitOptions}
          />
        ) : null}
        {mode === 'weekly' ? (
          <WeeklyBody planId={planId} units={units} entries={entries} />
        ) : null}
      </section>

      <ConfirmDialog
        open={pendingMode !== null}
        title={t('schedule.changeModeTitle')}
        description={t('schedule.changeModeDescription')}
        confirmLabel={t('schedule.changeMode')}
        onCancel={() => setPendingMode(null)}
        onConfirm={() => pendingMode && void applyModeChange(pendingMode)}
      />

      {!hasUnitOptions ? (
        <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
          {t('schedule.noUnits')}
        </p>
      ) : null}
    </div>
  );
}

/** Free rotation: the units in order, reorderable in place. */
function FreeRotationBody({ units }: { units: { id: string; name: string }[] }) {
  const { t } = useTranslation('plans');
  return (
    <div className="grid min-w-0 gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t('schedule.rotationOrder')}
      </p>
      <ol className="grid gap-2">
        {units.map((unit, index) => (
          <li
            key={unit.id}
            className="grid min-w-0 gap-2 rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 break-words pt-1 text-sm font-medium">
                {unit.name}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
              <IconButton
                label={t('schedule.moveUnitUp', { name: unit.name })}
                onClick={() => void moveDay(unit.id, -1)}
                {...(index === 0 ? { disabled: true } : {})}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={t('schedule.moveUnitDown', { name: unit.name })}
                onClick={() => void moveDay(unit.id, 1)}
                {...(index === units.length - 1 ? { disabled: true } : {})}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface CycleEntryRow {
  id: string;
  type: 'workout' | 'rest';
  templateId?: string;
  label?: string;
}

/** Repeating cycle: an ordered list of workout and rest days, with a "today" cursor. */
function CycleBody({
  planId,
  units,
  entries,
  cursor,
  hasUnitOptions,
}: {
  planId: string;
  units: { id: string; name: string }[];
  entries: CycleEntryRow[];
  cursor: number;
  hasUnitOptions: boolean;
}) {
  const { t } = useTranslation('plans');
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="grid min-w-0 gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t('schedule.cycleDays')}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">{t('schedule.cycleEmpty')}</p>
      ) : (
        <ol className="grid gap-2">
          {entries.map((entry, index) => {
            const isToday = index === cursor;
            return (
              <li
                key={entry.id}
                className={cn(
                  'grid min-w-0 gap-2 rounded-xl border p-3',
                  isToday ? 'border-accent bg-accent/5' : 'border-border bg-surface',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      isToday
                        ? 'bg-accent text-accent-contrast'
                        : 'bg-surface-2 text-muted',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {t('schedule.cycleDay', { day: index + 1 })}
                  </span>
                  {isToday ? (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-accent-contrast">
                      {t('schedule.today')}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  {entry.type === 'workout' ? (
                    <select
                      aria-label={t('schedule.unitForDay', { day: index + 1 })}
                      value={entry.templateId ?? ''}
                      onChange={(event) =>
                        void updateCycleEntry(entry.id, {
                          type: 'workout',
                          templateId: event.target.value,
                        })
                      }
                      className="min-h-[44px] w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-sm"
                    >
                      {entry.templateId &&
                      !units.some((u) => u.id === entry.templateId) ? (
                        <option value={entry.templateId}>
                          {t('schedule.removedUnit')}
                        </option>
                      ) : null}
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm text-muted">
                      {REST_ICON}
                      {t('schedule.restDay')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-2">
                  {!isToday ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setCyclePosition(planId, index)}
                    >
                      {t('schedule.setToday')}
                    </Button>
                  ) : null}
                  <IconButton
                    label={t('schedule.moveUp')}
                    onClick={() => void moveCycleEntry(entry.id, -1)}
                    {...(index === 0 ? { disabled: true } : {})}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={t('schedule.moveDown')}
                    onClick={() => void moveCycleEntry(entry.id, 1)}
                    {...(index === entries.length - 1 ? { disabled: true } : {})}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={t('schedule.duplicateDay')}
                    onClick={() => void duplicateCycleEntry(entry.id)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={t('schedule.removeDay')}
                    onClick={() => void deleteCycleEntry(entry.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasUnitOptions}
          onClick={() =>
            void addCycleEntry(planId, { type: 'workout', templateId: units[0]?.id })
          }
        >
          <Plus size={16} aria-hidden="true" />
          {t('schedule.trainingDay')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void addCycleEntry(planId, { type: 'rest' })}
        >
          <Moon size={16} aria-hidden="true" />
          {t('schedule.restDay')}
        </Button>
        {entries.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} aria-hidden="true" />
            {t('schedule.reset')}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={t('schedule.resetTitle')}
        description={t('schedule.resetDescription')}
        confirmLabel={t('schedule.reset')}
        destructive
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await resetCycle(planId);
          setResetOpen(false);
          toast.show(t('schedule.resetSuccess'), 'success');
        }}
      />
    </div>
  );
}

interface WeeklyEntryRow {
  id: string;
  type: 'workout' | 'rest';
  templateId?: string;
  weekday?: number;
  position: number;
}

/** Weekly plan: one assignment per weekday (workout unit, rest, or free). */
function WeeklyBody({
  planId,
  units,
  entries,
}: {
  planId: string;
  units: { id: string; name: string }[];
  entries: WeeklyEntryRow[];
}) {
  const { t } = useTranslation('plans');
  const byWeekday = new Map<number, WeeklyEntryRow>();
  for (const entry of entries) byWeekday.set(entry.weekday ?? entry.position, entry);
  const weekdays = t('schedule.weekdays', { returnObjects: true }) as string[];
  const todayWeekday = (new Date().getDay() + 6) % 7;

  const valueFor = (entry: WeeklyEntryRow | undefined): string => {
    if (!entry) return 'free';
    if (entry.type === 'rest') return 'rest';
    return entry.templateId ?? 'free';
  };

  const handleChange = (weekday: number, value: string) => {
    if (value === 'free') return void setWeekdayAssignment(planId, weekday, null);
    if (value === 'rest')
      return void setWeekdayAssignment(planId, weekday, { type: 'rest' });
    return void setWeekdayAssignment(planId, weekday, {
      type: 'workout',
      templateId: value,
    });
  };

  return (
    <div className="grid min-w-0 gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t('schedule.weeklyAssignments')}
      </p>
      {weekdays.map((label, weekday) => {
        const entry = byWeekday.get(weekday);
        const isToday = weekday === todayWeekday;
        return (
          <div
            key={weekday}
            className={cn(
              'grid min-w-0 gap-2 rounded-xl border p-3',
              isToday ? 'border-accent bg-accent/5' : 'border-border bg-surface',
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <CalendarDays size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
              {isToday ? (
                <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-accent-contrast">
                  {t('schedule.today')}
                </span>
              ) : null}
            </div>
            <select
              aria-label={t('schedule.assignmentFor', { day: label })}
              value={valueFor(entry)}
              onChange={(event) => handleChange(weekday, event.target.value)}
              className="min-h-[44px] w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-sm"
            >
              <option value="free">{t('schedule.free')}</option>
              <option value="rest">{t('schedule.rest')}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
              {entry?.type === 'workout' &&
              entry.templateId &&
              !units.some((u) => u.id === entry.templateId) ? (
                <option value={entry.templateId}>{t('schedule.removedUnit')}</option>
              ) : null}
            </select>
          </div>
        );
      })}
    </div>
  );
}
