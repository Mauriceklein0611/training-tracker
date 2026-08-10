import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarClock, Check, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatPercent } from '@/utils/format';

/** Everything the hero shows about the active plan; all derived, none invented. */
export interface ActivePlanHeroData {
  planId: string;
  planName: string;
  goalText?: string;
  /** Day names of the split, for the chips (e.g. Push · Pull · Beine). */
  days: {
    templateId: string;
    name: string;
    status: 'completed' | 'next' | 'upcoming';
  }[];
  /** Unit completed on the current local day, if any. */
  completedToday?: { templateId: string; name: string };
  /** The unit the schedule says to do next, if any. */
  nextUnit?: {
    templateId: string;
    name: string;
    exerciseCount: number;
    estimatedMinutes: number;
    /** Days since this unit was last completed, or null if never. */
    lastDoneDaysAgo: number | null;
    /** Calendar distance for date-bound schedules; absent for free rotation. */
    dayOffset?: number;
  };
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
  onConfigure,
}: {
  data: ActivePlanHeroData;
  /** True while another session is active — starting is then blocked. */
  disabled?: boolean;
  onStartNext: (templateId: string) => void;
  /** Open the unit editor to add exercises to an empty next unit. */
  onConfigure: (templateId: string) => void;
}) {
  const { t } = useTranslation('home');
  return (
    <section
      aria-labelledby="active-plan-heading"
      className="mb-4 rounded-2xl border border-accent/50 bg-surface p-4"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-accent">
        {t('hero.label')}
      </p>
      <div className="mt-1 flex items-start justify-between gap-2">
        <Link to={`/plaene/${data.planId}`} className="min-w-0 flex-1">
          <h2 id="active-plan-heading" className="break-words text-lg font-semibold">
            {data.planName}
          </h2>
          {data.goalText ? (
            <p className="break-words text-sm text-muted">{data.goalText}</p>
          ) : null}
        </Link>
        {data.cycleWeek ? (
          <span className="numeric shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-muted">
            {t('hero.cycleWeek', {
              current: data.cycleWeek.current,
              total: data.cycleWeek.total,
            })}
          </span>
        ) : null}
      </div>

      {data.days.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.days.map((day) => {
            return (
              <span
                key={day.templateId}
                className={
                  day.status === 'next'
                    ? 'rounded-lg bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent'
                    : 'rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted'
                }
              >
                {day.status === 'completed' ? (
                  <Check size={12} className="mr-1 inline" aria-hidden="true" />
                ) : day.status === 'next' ? (
                  <ArrowRight size={12} className="mr-1 inline" aria-hidden="true" />
                ) : null}
                {day.name}
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
              {t('hero.deloadTitle', { count: data.deload.remainingDays })}
            </p>
            <p className="text-muted">
              {t('hero.deloadText', {
                percent: formatPercent(data.deload.percent),
                intensity: data.deload.intensityLabel,
                endDate: data.deload.endDate,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        {data.completedToday ? (
          <div className="mb-3 rounded-xl border border-success/40 bg-surface-2 p-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-success">
              {t('hero.completedToday')}
            </p>
            <p className="mt-0.5 flex min-w-0 items-start gap-1.5 text-sm font-semibold">
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{data.completedToday.name}</span>
            </p>
          </div>
        ) : null}
        {data.nextUnit ? (
          <>
            <p className="mb-0.5 text-sm">
              <span className="text-muted">{t('hero.nextLabel')}</span>
              <span className="break-words font-semibold">{data.nextUnit.name}</span>
            </p>
            {data.nextUnit.dayOffset != null && data.nextUnit.dayOffset > 0 ? (
              <p className="mb-1 text-xs font-medium text-accent">
                {data.nextUnit.dayOffset === 1
                  ? t('hero.tomorrow')
                  : t('hero.inDays', { count: data.nextUnit.dayOffset })}
              </p>
            ) : null}
            {data.nextUnit.exerciseCount === 0 ? (
              // An empty unit can't be trained yet — configuring it is the real
              // next step, and it must not silently start an empty session.
              <>
                <p className="mb-2 text-xs text-muted">{t('hero.emptyUnit')}</p>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => onConfigure(data.nextUnit!.templateId)}
                >
                  <SlidersHorizontal size={20} aria-hidden="true" />
                  {t('hero.configureUnit')}
                </Button>
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted">
                  {t('exerciseCount', { count: data.nextUnit.exerciseCount })}
                  {data.nextUnit.estimatedMinutes > 0
                    ? t('hero.estimate', { minutes: data.nextUnit.estimatedMinutes })
                    : ''}
                  {data.nextUnit.lastDoneDaysAgo == null
                    ? ''
                    : data.nextUnit.lastDoneDaysAgo === 0
                      ? t('hero.lastDoneToday')
                      : data.nextUnit.lastDoneDaysAgo === 1
                        ? t('hero.lastDoneYesterday')
                        : t('hero.lastDoneDaysAgo', {
                            count: data.nextUnit.lastDoneDaysAgo,
                          })}
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={disabled}
                  onClick={() => onStartNext(data.nextUnit!.templateId)}
                >
                  <Play size={20} aria-hidden="true" />
                  {t('hero.startTraining')}
                </Button>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t('hero.noNextUnit')}</p>
        )}
        {data.lastUnitName ? (
          <p className="mt-2 text-xs text-muted">
            {t('hero.lastUnit', { name: data.lastUnitName })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
