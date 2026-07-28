import { Link } from 'react-router-dom';
import { CalendarClock, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPercent } from '@/utils/format';

/** Everything the hero shows about the active plan; all derived, none invented. */
export interface ActivePlanHeroData {
  planId: string;
  planName: string;
  goalText?: string;
  /** Day names of the split, for the chips (e.g. Push · Pull · Beine). */
  dayNames: string[];
  /** The unit the schedule says to do next, if any. */
  nextUnit?: { templateId: string; name: string };
  /** Name of the most recently completed unit, if any. */
  lastUnitName?: string;
  /** Cycle week, 1-based, and the planned total. */
  cycleWeek?: { current: number; total: number };
  /** Active deload, if one covers today. */
  deload?: {
    remainingDays: number;
    endDate: string;
    intensityLabel: string;
    percent: number;
  };
}

/**
 * The homescreen's most important card: the active plan, where you are in its
 * cycle, what to do next, and a single clear start action. A running deload is
 * shown prominently but calmly — a planned reduction, not an alarm.
 */
export function ActivePlanHero({
  data,
  disabled,
  onStartNext,
}: {
  data: ActivePlanHeroData;
  /** True while another session is active — starting is then blocked. */
  disabled?: boolean;
  onStartNext: (templateId: string) => void;
}) {
  return (
    <section
      aria-labelledby="active-plan-heading"
      className="mb-4 rounded-2xl border border-accent/50 bg-surface p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-accent">
        Aktiver Trainingsplan
      </p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <Link to={`/plaene/${data.planId}`} className="min-w-0">
          <h2 id="active-plan-heading" className="truncate text-lg font-semibold">
            {data.planName}
          </h2>
          {data.goalText ? (
            <p className="truncate text-sm text-muted">{data.goalText}</p>
          ) : null}
        </Link>
        {data.cycleWeek ? (
          <span className="numeric shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-muted">
            Woche {data.cycleWeek.current} / {data.cycleWeek.total}
          </span>
        ) : null}
      </div>

      {data.dayNames.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.dayNames.map((name, index) => {
            const isNext = data.nextUnit != null && name === data.nextUnit.name;
            return (
              <span
                key={`${name}-${index}`}
                className={
                  isNext
                    ? 'rounded-lg bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent'
                    : 'rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted'
                }
              >
                {name}
              </span>
            );
          })}
        </div>
      ) : null}

      {data.deload ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-surface-2 p-2.5">
          <CalendarClock
            size={18}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-warning">
              Deload aktiv · noch {data.deload.remainingDays}{' '}
              {data.deload.remainingDays === 1 ? 'Tag' : 'Tage'}
            </p>
            <p className="text-muted">
              Zielwerte sind diese Woche um {formatPercent(data.deload.percent)} reduziert
              ({data.deload.intensityLabel}). Bis {data.deload.endDate}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        {data.nextUnit ? (
          <>
            <p className="mb-1 text-sm">
              <span className="text-muted">Als Nächstes: </span>
              <span className="font-semibold">{data.nextUnit.name}</span>
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={disabled}
              onClick={() => onStartNext(data.nextUnit!.templateId)}
            >
              <Play size={20} aria-hidden="true" />
              Training starten
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Für diesen Plan ist aktuell keine nächste Einheit geplant.
          </p>
        )}
        {data.lastUnitName ? (
          <p className="mt-2 text-xs text-muted">Zuletzt: {data.lastUnitName}</p>
        ) : null}
      </div>
    </section>
  );
}
