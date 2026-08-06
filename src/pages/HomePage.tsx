import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Download,
  Play,
  Plus,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { db } from '@/db/db';
import { listTemplates } from '@/db/repositories/templates';
import { getPlanWithDays, listPlansWithDays } from '@/db/repositories/plans';
import { getPlanScheduleState } from '@/db/repositories/schedules';
import { getActiveDeload } from '@/db/repositories/planDeload';
import { DELOAD_PERCENT, deloadRemainingDays } from '@/services/deload';
import { planCycleWeek } from '@/services/home';
import { estimateUnitMinutes } from '@/services/sessionEstimate';
import { buildCoachInsights } from '@/services/coachFeed';
import { ActivePlanHero, type ActivePlanHeroData } from '@/features/home/ActivePlanHero';
import { CoachFeed } from '@/features/home/CoachFeed';
import {
  ActiveSessionExistsError,
  startFreeSession,
  startSessionFromPreviousSession,
  startSessionFromTemplate,
  startSessionFromWorkoutUnit,
} from '@/db/repositories/sessions';
import { StartFreeDialog } from '@/features/home/StartFreeDialog';
import { SupportHint } from '@/features/community/SupportHint';
import { shouldShowSupportHint } from '@/services/supportHint';
import { PlanPackageTools } from '@/features/plans/PlanPackageTools';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { loadAnalyticsDataset } from '@/services/dataset';
import { computeAnalytics } from '@/services/analytics';
import { isBackupOverdue } from '@/services/storage';
import {
  customRange,
  dayGreeting,
  dayKey,
  formatDate,
  formatDateTime,
  formatDayReference,
  formatDurationLong,
  lastDaysRange,
  startOfWeekDate,
  weekKey,
} from '@/utils/date';
import { formatNumber, formatVolume } from '@/utils/format';

/**
 * Start screen.
 *
 * Optimised for the one thing that happens at the gym: starting or resuming a
 * workout. Statistics stay short — the analytics screen is one tap away.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { t: tHome } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const toast = useToast();
  const activeSession = useActiveSession();
  const { settings, update } = useSettings();

  const templates = useLiveQuery(() => listTemplates(), [], []);

  const plans = useLiveQuery(
    async () => {
      const withDays = await listPlansWithDays();
      return Promise.all(
        withDays.map(async (entry) => {
          const state = await getPlanScheduleState(entry.plan.id);
          const next = state.nextWorkout?.template;
          // Weekly plans pin days to weekdays, so "today" is a real calendar day:
          // surface a scheduled rest/free day instead of implying a workout.
          const restToday =
            state.mode === 'weekly' && state.current?.type === 'rest'
              ? (state.current.name ?? undefined)
              : undefined;
          return {
            plan: entry.plan,
            dayCount: entry.days.length,
            nextDayId: next?.id,
            nextDayName: next?.name,
            restToday,
          };
        }),
      );
    },
    [],
    [],
  );

  const activePlanId = settings.activePlanId;
  const activePlan = useLiveQuery<ActivePlanHeroData | null>(async () => {
    if (!activePlanId) return null;
    const withDays = await getPlanWithDays(activePlanId);
    if (!withDays) return null;
    const { plan, days } = withDays;
    const state = await getPlanScheduleState(activePlanId);
    const deloadPeriod = await getActiveDeload(activePlanId);

    const next = state.nextWorkout?.template;
    const cycleWeek = planCycleWeek(plan.startDate, plan.plannedWeeks) ?? undefined;
    const deload = deloadPeriod
      ? {
          remainingDays: deloadRemainingDays(deloadPeriod, new Date()),
          endDate: formatDate(deloadPeriod.endDate),
          intensityLabel: tHome(`hero.deloadIntensity.${deloadPeriod.intensity}`),
          percent: DELOAD_PERCENT[deloadPeriod.intensity],
        }
      : undefined;

    // Details for the "up next" hero: exercise count, a rough duration
    // estimate, and when this unit was last completed.
    let nextUnit: ActivePlanHeroData['nextUnit'];
    if (next) {
      const rows = await db.templateExercises
        .where('templateId')
        .equals(next.id)
        .toArray();
      const dataset = await loadAnalyticsDataset();
      const lastDone = dataset.sessions
        .filter((s) => s.status === 'completed' && s.templateId === next.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      const lastDoneDaysAgo = lastDone
        ? Math.max(
            0,
            Math.floor(
              (new Date(dayKey(new Date())).getTime() -
                new Date(dayKey(lastDone.startedAt)).getTime()) /
                86400000,
            ),
          )
        : null;
      nextUnit = {
        templateId: next.id,
        name: next.name,
        exerciseCount: rows.length,
        estimatedMinutes: estimateUnitMinutes(rows),
        lastDoneDaysAgo,
      };
    }

    return {
      planId: plan.id,
      planName: plan.name,
      goalText: plan.goalText,
      dayNames: days.map((day) => day.name),
      nextUnit,
      cycleWeek,
      deload,
    };
  }, [activePlanId, tHome]);

  const overview = useLiveQuery(async () => {
    const dataset = await loadAnalyticsDataset();
    const analytics = computeAnalytics(dataset, lastDaysRange(30));
    // This week's figures for the week-progress card (Mon–today, local).
    const weekRange = customRange(dayKey(startOfWeekDate()), dayKey(new Date()));
    const weekAnalytics = computeAnalytics(dataset, weekRange);
    const completed = dataset.sessions
      .filter((session) => session.status === 'completed')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    const currentWeek = weekKey(new Date());
    return {
      analytics,
      weekAnalytics,
      // Deterministic, explainable insights from the same local dataset.
      insights: buildCoachInsights(dataset),
      lastSession: completed[0],
      totalSessions: completed.length,
      sessionsThisWeek: completed.filter(
        (session) => weekKey(session.startedAt) === currentWeek,
      ).length,
    };
  }, []);

  const startTemplate = useCallback(
    async (templateId: string) => {
      try {
        const session = await startSessionFromTemplate(templateId);
        navigate(`/training/${session.id}`);
      } catch (error) {
        if (error instanceof ActiveSessionExistsError) {
          toast.show(tHome('errors.sessionAlreadyRunning'), 'error');
          navigate(`/training/${error.activeSessionId}`);
          return;
        }
        toast.show(tHome('errors.startFailed'), 'error');
      }
    },
    [navigate, toast, tHome],
  );

  // "Freies Training" opens a small chooser: an empty session, or one started
  // from a saved library unit.
  const [startFreeOpen, setStartFreeOpen] = useState(false);
  const [importPlanOpen, setImportPlanOpen] = useState(false);
  // "Später" only closes the card for this visit; the 30-day cooldown is stored.
  const [supportHintClosed, setSupportHintClosed] = useState(false);

  const startFree = useCallback(async () => {
    try {
      const session = await startFreeSession();
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(tHome('errors.startFailed'), 'error');
    }
  }, [navigate, toast, tHome]);

  const startUnit = useCallback(
    async (unitId: string) => {
      try {
        const session = await startSessionFromWorkoutUnit(unitId);
        navigate(`/training/${session.id}`);
      } catch (error) {
        if (error instanceof ActiveSessionExistsError) {
          navigate(`/training/${error.activeSessionId}`);
          return;
        }
        toast.show(tHome('errors.startFailed'), 'error');
      }
    },
    [navigate, toast, tHome],
  );

  // Quick cardio entry: a free session (or the existing one) with the exercise
  // picker opened straight onto cardio activities — no second session model.
  const startCardio = useCallback(async () => {
    try {
      const session = await startFreeSession();
      navigate(`/training/${session.id}?add=cardio`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}?add=cardio`);
        return;
      }
      toast.show(tHome('errors.startFailed'), 'error');
    }
  }, [navigate, toast, tHome]);

  const repeatLast = useCallback(async () => {
    const lastId = overview?.lastSession?.id;
    if (!lastId) return;
    try {
      const session = await startSessionFromPreviousSession(lastId);
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(tHome('errors.startFailed'), 'error');
    }
  }, [navigate, toast, tHome, overview?.lastSession?.id]);

  const exerciseCount = useLiveQuery(() => db.exercises.count(), [], 0);
  const backupOverdue = isBackupOverdue(
    settings.lastBackupAt,
    settings.backupReminderDays,
  );
  const hasHistory = (overview?.totalSessions ?? 0) > 0;

  // Voluntary support hint (#32): only after proven usage, at most once every
  // 30 days, never while training and never on the day a workout was finished.
  const showSupportHint =
    overview !== undefined &&
    shouldShowSupportHint({
      finishedSessions: overview.totalSessions,
      lastFinishedDayKey: overview.lastSession
        ? dayKey(overview.lastSession.startedAt)
        : undefined,
      hasRunningWorkout: Boolean(activeSession),
      lastShownAt: settings.supportHintLastShownAt,
      dismissed: settings.supportHintDismissed,
      todayDayKey: dayKey(new Date()),
      now: new Date(),
    });

  const lastTemplateId = overview?.lastSession?.templateId;
  const lastTemplate = lastTemplateId
    ? templates.find((template) => template.id === lastTemplateId)
    : undefined;

  return (
    <>
      {/* The name is only used to personalise the greeting (#46); without one
          the header reads exactly as before. */}
      <PageHeader
        title={
          settings.displayName
            ? tCommon('greeting.withName', {
                greeting: dayGreeting(),
                name: settings.displayName,
              })
            : dayGreeting()
        }
        subtitle={formatDayReference()}
      />

      {/* Resuming an interrupted workout is always the first thing offered. */}
      {activeSession ? (
        <Card className="mb-4 border-accent/60 bg-surface">
          <CardHeader
            title={tHome('activeSession.title')}
            subtitle={tHome('activeSession.subtitle', {
              name: activeSession.name,
              startedAt: formatDateTime(activeSession.startedAt),
            })}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(`/training/${activeSession.id}`)}
          >
            <Play size={20} aria-hidden="true" />
            {tHome('activeSession.resume')}
          </Button>
        </Card>
      ) : null}

      {/* The active plan is the headline: where you are and what to do next. */}
      {activePlan ? (
        <ActivePlanHero
          data={activePlan}
          disabled={Boolean(activeSession)}
          onStartNext={(templateId) => void startTemplate(templateId)}
          onConfigure={(templateId) => navigate(`/bibliothek/${templateId}`)}
        />
      ) : !activeSession ? (
        <Card className="mb-4">
          <CardHeader
            title={tHome('noActivePlan.title')}
            subtitle={
              plans.length > 0
                ? tHome('noActivePlan.withPlans')
                : tHome('noActivePlan.withoutPlans')
            }
          />
          <div className="grid gap-2">
            <Button variant="primary" onClick={() => navigate('/plaene')}>
              <ClipboardList size={18} aria-hidden="true" />
              {plans.length > 0
                ? tHome('noActivePlan.activate')
                : tHome('noActivePlan.create')}
            </Button>
            <Button variant="secondary" onClick={() => setImportPlanOpen(true)}>
              <Download size={18} aria-hidden="true" />
              {tHome('noActivePlan.import')}
            </Button>
          </div>
        </Card>
      ) : null}

      {backupOverdue && hasHistory ? (
        <Link
          to="/mehr/daten"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/50 bg-surface p-4"
        >
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-warning">
              {tHome('backupOverdue.title')}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {settings.lastBackupAt
                ? tHome('backupOverdue.last', {
                    date: formatDateTime(settings.lastBackupAt),
                  })
                : tHome('backupOverdue.never')}{' '}
              {tHome('backupOverdue.cta')}
            </p>
          </div>
        </Link>
      ) : null}

      {!activeSession ? (
        <section className="mb-6" aria-labelledby="start-heading">
          <h2 id="start-heading" className="sr-only">
            {tHome('start.heading')}
          </h2>
          <div className="grid gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setStartFreeOpen(true)}
            >
              <Zap size={20} aria-hidden="true" />
              {tHome('start.free')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => void startCardio()}>
              <Activity size={18} aria-hidden="true" />
              {tHome('start.cardio')}
            </Button>
            {/* Quick actions: repeat the last workout or restart its plan. */}
            {overview?.lastSession ? (
              <Button variant="secondary" fullWidth onClick={() => void repeatLast()}>
                <RotateCcw size={18} aria-hidden="true" />
                {tHome('start.repeatLast')}
              </Button>
            ) : null}
            {lastTemplate ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => void startTemplate(lastTemplate.id)}
              >
                <Play size={18} aria-hidden="true" />
                {tHome('start.repeatNamed', { name: lastTemplate.name })}
              </Button>
            ) : null}
            {exerciseCount === 0 ? (
              <p className="text-xs leading-relaxed text-muted">
                {tHome('start.noExercises')}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-6" aria-labelledby="templates-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="templates-heading" className="text-base font-semibold">
            {tHome('plans.heading')}
          </h2>
          <Link
            to="/plaene"
            className="text-sm font-medium text-accent"
            aria-label={tHome('plans.seeAllLabel')}
          >
            {tHome('plans.seeAll')}
          </Link>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} aria-hidden="true" />}
            title={tHome('plans.emptyTitle')}
            description={tHome('plans.emptyDescription')}
            action={
              <Button variant="secondary" onClick={() => navigate('/plaene')}>
                <Plus size={18} aria-hidden="true" />
                {tHome('noActivePlan.create')}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-2">
            {/* The active plan already has its hero above — don't repeat it here. */}
            {plans
              .filter((entry) => entry.plan.id !== activePlanId)
              .slice(0, 5)
              .map((entry) => {
                const multiDay = entry.dayCount > 1;
                return (
                  <li key={entry.plan.id} className="min-w-0">
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3">
                      <Link to={`/plaene/${entry.plan.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.plan.name}</p>
                        {entry.restToday ? (
                          <p className="truncate text-xs text-muted">
                            {tHome('plans.today', { name: entry.restToday })}
                          </p>
                        ) : null}
                        {multiDay && entry.nextDayName ? (
                          <p className="truncate text-xs text-accent">
                            {tHome('plans.next', { name: entry.nextDayName })}
                          </p>
                        ) : null}
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        className="shrink-0"
                        disabled={Boolean(activeSession) || !entry.nextDayId}
                        onClick={() =>
                          entry.nextDayId && void startTemplate(entry.nextDayId)
                        }
                      >
                        <Play size={16} aria-hidden="true" />
                        {tHome('plans.startEntry')}
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {hasHistory && overview?.insights ? (
        <CoachFeed insights={overview.insights} />
      ) : null}

      {/* Inline and skippable — never a modal, never a repeating banner (#32). */}
      {showSupportHint && !supportHintClosed ? (
        <SupportHint
          onShown={() =>
            void update({ supportHintLastShownAt: new Date().toISOString() })
          }
          onLater={() => setSupportHintClosed(true)}
          onDismiss={() => {
            setSupportHintClosed(true);
            void update({ supportHintDismissed: true });
          }}
        />
      ) : null}

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-3 text-base font-semibold">
          {tHome('overview.heading')}
        </h2>

        {!hasHistory ? (
          <EmptyState
            title={tHome('overview.emptyTitle')}
            description={tHome('overview.emptyDescription')}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label={tHome('overview.thisWeek')}
                value={formatNumber(overview?.sessionsThisWeek)}
                hint={tHome('overview.thisWeekHint')}
                tone="accent"
              />
              <Stat
                label={tHome('overview.streak')}
                value={formatNumber(overview?.analytics.streakWeeks)}
                hint={tHome('overview.streakHint')}
              />
              <Stat
                label={tHome('overview.workingSetsWeek')}
                value={formatNumber(overview?.weekAnalytics.workingSetCount)}
                hint={tHome('overview.hintThisWeek')}
              />
              <Stat
                label={tHome('overview.cardioWeek')}
                value={`${formatNumber(
                  Math.round(
                    (overview?.weekAnalytics.cardio.totalDurationSeconds ?? 0) / 60,
                  ),
                )} min`}
                hint={tHome('overview.hintThisWeek')}
              />
              <Stat
                label={tHome('overview.days30')}
                value={formatNumber(overview?.analytics.sessionCount)}
                hint={tHome('overview.days30Hint')}
              />
              <Stat
                label={tHome('overview.volume30')}
                value={formatVolume(overview?.analytics.volume.volumeKg)}
                hint={tHome('overview.volume30Hint')}
              />
            </div>

            {overview?.lastSession ? (
              <Link
                to={`/verlauf/${overview.lastSession.id}`}
                className="mt-2 block rounded-2xl border border-border bg-surface p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {tHome('overview.lastSession')}
                </p>
                <p className="mt-1 font-medium">{overview.lastSession.name}</p>
                <p className="text-sm text-muted">
                  {formatDateTime(overview.lastSession.startedAt)}
                  {overview.lastSession.finishedAt
                    ? ` · ${formatDurationLong(
                        (new Date(overview.lastSession.finishedAt).getTime() -
                          new Date(overview.lastSession.startedAt).getTime()) /
                          1000,
                      )}`
                    : ''}
                </p>
              </Link>
            ) : null}
          </>
        )}
      </section>

      <StartFreeDialog
        open={startFreeOpen}
        onClose={() => setStartFreeOpen(false)}
        onStartEmpty={() => {
          setStartFreeOpen(false);
          void startFree();
        }}
        onStartUnit={(unitId) => {
          setStartFreeOpen(false);
          void startUnit(unitId);
        }}
      />

      {/* Same two-way flow as the "Pläne" page, reachable when no plan is active:
          import a shared plan file, or first build one with AI. */}
      <Dialog
        open={importPlanOpen}
        onClose={() => setImportPlanOpen(false)}
        title={tHome('importDialog.title')}
        description={tHome('importDialog.description')}
      >
        <PlanPackageTools embedded />
      </Dialog>
    </>
  );
}
