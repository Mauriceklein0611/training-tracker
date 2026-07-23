import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Copy,
  Dumbbell,
  Moon,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Field';
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
import {
  SCHEDULE_MODE_DESCRIPTIONS,
  SCHEDULE_MODE_LABELS,
  WEEKDAY_LABELS,
} from '@/services/schedule';
import type { ScheduleMode } from '@/types';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

const REST_ICON = <Moon size={15} aria-hidden="true" />;

/** A small pill showing one scheduled day (workout unit or rest). */
function DayChip({
  name,
  rest,
  muted,
}: {
  name: string;
  rest?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        rest
          ? 'border-border bg-surface-2 text-muted'
          : 'border-accent/40 bg-accent/10 text-accent',
        muted && 'opacity-60',
      )}
    >
      {rest ? REST_ICON : <Dumbbell size={13} aria-hidden="true" />}
      <span className="max-w-[9rem] truncate">{name}</span>
    </span>
  );
}

/**
 * Editor for a plan's time layout: pick a mode and lay the plan's reusable
 * workout units out as a free rotation, a repeating cycle (with rest days) or a
 * weekly plan. Reads live so every edit is reflected immediately, including the
 * "coming up" preview.
 */
export function ScheduleEditor({ planId }: { planId: string }) {
  const view = useLiveQuery(() => getPlanScheduleView(planId), [planId]);
  const state = useLiveQuery(() => getPlanScheduleState(planId), [planId]);
  const [pendingMode, setPendingMode] = useState<ScheduleMode | null>(null);

  if (!view) {
    return (
      <p className="text-sm text-muted" role="status">
        Wird geladen …
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
    <div className="grid gap-4">
      <Segmented<ScheduleMode>
        label="Zeitplan-Modus"
        value={mode}
        onChange={requestModeChange}
        options={[
          { value: 'free-rotation', label: SCHEDULE_MODE_LABELS['free-rotation'] },
          { value: 'repeating-cycle', label: SCHEDULE_MODE_LABELS['repeating-cycle'] },
          { value: 'weekly', label: SCHEDULE_MODE_LABELS.weekly },
        ]}
      />
      <p className="text-xs leading-relaxed text-muted">
        {SCHEDULE_MODE_DESCRIPTIONS[mode]}
      </p>

      {/* Coming-up preview, shared by all modes. */}
      {state && state.upcoming.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Als Nächstes</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {state.upcoming.map((item, index) => (
              <div
                key={`${item.entry.id}-${index}`}
                className="flex items-center gap-1.5"
              >
                {index > 0 ? <span className="text-muted">→</span> : null}
                <DayChip name={item.name} rest={item.type === 'rest'} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

      <ConfirmDialog
        open={pendingMode !== null}
        title="Modus wechseln?"
        description="Der aktuelle Zeitplan wird dabei zurückgesetzt. Die Übungseinheiten und ihre Übungen bleiben unverändert erhalten."
        confirmLabel="Wechseln"
        onCancel={() => setPendingMode(null)}
        onConfirm={() => pendingMode && void applyModeChange(pendingMode)}
      />

      {!hasUnitOptions ? (
        <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
          Dieser Plan hat noch keine Übungseinheit. Füge zuerst eine Einheit hinzu, um sie
          im Zeitplan zu verwenden.
        </p>
      ) : null}
    </div>
  );
}

/** Free rotation: the units in order, reorderable in place. */
function FreeRotationBody({ units }: { units: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">
        Die Übungseinheiten werden in dieser Reihenfolge vorgeschlagen. Pausentage
        entstehen einfach dadurch, dass du an einem Tag nicht trainierst.
      </p>
      <ol className="grid gap-2">
        {units.map((unit, index) => (
          <li
            key={unit.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {unit.name}
            </span>
            <IconButton
              label={`${unit.name} nach oben`}
              onClick={() => void moveDay(unit.id, -1)}
              {...(index === 0 ? { disabled: true } : {})}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`${unit.name} nach unten`}
              onClick={() => void moveDay(unit.id, 1)}
              {...(index === units.length - 1 ? { disabled: true } : {})}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </IconButton>
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
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="grid gap-2">
      {entries.length === 0 ? (
        <p className="text-xs text-muted">
          Noch keine Zyklustage. Füge Trainings- und Pausentage in der gewünschten
          Reihenfolge hinzu; nach dem letzten Tag beginnt der Zyklus von vorn.
        </p>
      ) : (
        <ol className="grid gap-2">
          {entries.map((entry, index) => {
            const isToday = index === cursor;
            return (
              <li
                key={entry.id}
                className={cn(
                  'rounded-xl border p-2',
                  isToday ? 'border-accent bg-accent/5' : 'border-border bg-surface',
                )}
              >
                <div className="flex items-center gap-2">
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
                  {entry.type === 'workout' ? (
                    <select
                      aria-label={`Einheit für Tag ${index + 1}`}
                      value={entry.templateId ?? ''}
                      onChange={(event) =>
                        void updateCycleEntry(entry.id, {
                          type: 'workout',
                          templateId: event.target.value,
                        })
                      }
                      className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 text-sm"
                    >
                      {entry.templateId &&
                      !units.some((u) => u.id === entry.templateId) ? (
                        <option value={entry.templateId}>Entfernte Einheit</option>
                      ) : null}
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted">
                      {REST_ICON}
                      Pausentag
                    </span>
                  )}
                  {isToday ? (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-contrast">
                      Heute
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  {!isToday ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setCyclePosition(planId, index)}
                    >
                      Als heute
                    </Button>
                  ) : null}
                  <IconButton
                    label="Nach oben"
                    onClick={() => void moveCycleEntry(entry.id, -1)}
                    {...(index === 0 ? { disabled: true } : {})}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Nach unten"
                    onClick={() => void moveCycleEntry(entry.id, 1)}
                    {...(index === entries.length - 1 ? { disabled: true } : {})}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Tag duplizieren"
                    onClick={() => void duplicateCycleEntry(entry.id)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Tag entfernen"
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
          Trainingstag
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void addCycleEntry(planId, { type: 'rest' })}
        >
          <Moon size={16} aria-hidden="true" />
          Pausentag
        </Button>
        {entries.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} aria-hidden="true" />
            Zurücksetzen
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Zyklus zurücksetzen?"
        description="Alle Zyklustage werden entfernt. Die Übungseinheiten selbst bleiben erhalten."
        confirmLabel="Zurücksetzen"
        destructive
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await resetCycle(planId);
          setResetOpen(false);
          toast.show('Zyklus zurückgesetzt.', 'success');
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
  const byWeekday = new Map<number, WeeklyEntryRow>();
  for (const entry of entries) byWeekday.set(entry.weekday ?? entry.position, entry);

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
    <div className="grid gap-2">
      {WEEKDAY_LABELS.map((label, weekday) => {
        const entry = byWeekday.get(weekday);
        return (
          <div
            key={weekday}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2"
          >
            <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="w-24 shrink-0 text-sm font-medium">{label}</span>
            <select
              aria-label={`Zuordnung für ${label}`}
              value={valueFor(entry)}
              onChange={(event) => handleChange(weekday, event.target.value)}
              className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="free">Frei</option>
              <option value="rest">Pause</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
              {entry?.type === 'workout' &&
              entry.templateId &&
              !units.some((u) => u.id === entry.templateId) ? (
                <option value={entry.templateId}>Entfernte Einheit</option>
              ) : null}
            </select>
          </div>
        );
      })}
    </div>
  );
}
