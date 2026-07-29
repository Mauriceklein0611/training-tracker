import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
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
import {
  DELOAD_INTENSITY_LABELS,
  DELOAD_PERCENT,
  deloadRemainingDays,
} from '@/services/deload';
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
} from '@/db/repositories/sessions';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
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
  const toast = useToast();
  const activeSession = useActiveSession();
  const { settings } = useSettings();

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
          intensityLabel: DELOAD_INTENSITY_LABELS[deloadPeriod.intensity],
          percent: DELOAD_PERCENT[deloadPeriod.intensity],
        }
      : undefined;

    // Details for the "Als Nächstes" hero: exercise count, a rough duration
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
  }, [activePlanId]);

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
          toast.show('Es läuft bereits eine Trainingseinheit.', 'error');
          navigate(`/training/${error.activeSessionId}`);
          return;
        }
        toast.show(
          error instanceof Error ? error.message : 'Start fehlgeschlagen.',
          'error',
        );
      }
    },
    [navigate, toast],
  );

  const startFree = useCallback(async () => {
    try {
      const session = await startFreeSession();
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(
        error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        'error',
      );
    }
  }, [navigate, toast]);

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
      toast.show(
        error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        'error',
      );
    }
  }, [navigate, toast]);

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
      toast.show(
        error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        'error',
      );
    }
  }, [navigate, toast, overview?.lastSession?.id]);

  const exerciseCount = useLiveQuery(() => db.exercises.count(), [], 0);
  const backupOverdue = isBackupOverdue(
    settings.lastBackupAt,
    settings.backupReminderDays,
  );
  const hasHistory = (overview?.totalSessions ?? 0) > 0;
  const lastTemplateId = overview?.lastSession?.templateId;
  const lastTemplate = lastTemplateId
    ? templates.find((template) => template.id === lastTemplateId)
    : undefined;

  return (
    <>
      <PageHeader title={dayGreeting()} subtitle={formatDayReference()} />

      {/* Resuming an interrupted workout is always the first thing offered. */}
      {activeSession ? (
        <Card className="mb-4 border-accent/60 bg-surface">
          <CardHeader
            title="Laufende Trainingseinheit"
            subtitle={`${activeSession.name} · gestartet ${formatDateTime(activeSession.startedAt)}`}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(`/training/${activeSession.id}`)}
          >
            <Play size={20} aria-hidden="true" />
            Training fortsetzen
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
            title="Kein aktiver Trainingsplan"
            subtitle={
              plans.length > 0
                ? 'Aktiviere einen Plan, damit dein Homescreen dir die nächste Einheit und den Zyklus zeigt.'
                : 'Erstelle oder importiere einen Plan — oder trainiere gleich frei.'
            }
          />
          <div className="grid gap-2">
            <Button variant="primary" onClick={() => navigate('/plaene')}>
              <ClipboardList size={18} aria-hidden="true" />
              {plans.length > 0 ? 'Plan aktivieren' : 'Plan erstellen'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/mehr/daten')}>
              <Download size={18} aria-hidden="true" />
              Planpaket oder KI-Datei importieren
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
            <p className="text-sm font-semibold text-warning">Sicherung überfällig</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {settings.lastBackupAt
                ? `Letzte Sicherung: ${formatDateTime(settings.lastBackupAt)}.`
                : 'Es wurde noch nie eine Sicherung erstellt.'}{' '}
              Jetzt Backup erstellen →
            </p>
          </div>
        </Link>
      ) : null}

      {!activeSession ? (
        <section className="mb-6" aria-labelledby="start-heading">
          <h2 id="start-heading" className="sr-only">
            Training starten
          </h2>
          <div className="grid gap-2">
            <Button variant="primary" size="lg" fullWidth onClick={startFree}>
              <Zap size={20} aria-hidden="true" />
              Freies Training starten
            </Button>
            <Button variant="secondary" fullWidth onClick={() => void startCardio()}>
              <Activity size={18} aria-hidden="true" />
              Cardio starten
            </Button>
            {/* Quick actions: repeat the last workout or restart its plan. */}
            {overview?.lastSession ? (
              <Button variant="secondary" fullWidth onClick={() => void repeatLast()}>
                <RotateCcw size={18} aria-hidden="true" />
                Letztes Training wiederholen
              </Button>
            ) : null}
            {lastTemplate ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => void startTemplate(lastTemplate.id)}
              >
                <Play size={18} aria-hidden="true" />„{lastTemplate.name}" erneut starten
              </Button>
            ) : null}
            {exerciseCount === 0 ? (
              <p className="text-xs leading-relaxed text-muted">
                Du hast noch keine Übungen angelegt. Du kannst sie auch direkt während des
                Trainings erstellen.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-6" aria-labelledby="templates-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="templates-heading" className="text-base font-semibold">
            Trainingspläne
          </h2>
          <Link to="/plaene" className="text-sm font-medium text-accent">
            Alle ansehen
          </Link>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} aria-hidden="true" />}
            title="Noch keine Trainingspläne"
            description="Lege einen Plan an, um wiederkehrende Trainings mit festen Übungen, Ziel-Sätzen und Pausenzeiten zu starten. Für spontane Einheiten reicht das freie Training."
            action={
              <Button variant="secondary" onClick={() => navigate('/plaene')}>
                <Plus size={18} aria-hidden="true" />
                Plan erstellen
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
                            Heute: {entry.restToday}
                          </p>
                        ) : null}
                        {multiDay && entry.nextDayName ? (
                          <p className="truncate text-xs text-accent">
                            Als Nächstes: {entry.nextDayName}
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
                        Starten
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

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-3 text-base font-semibold">
          Überblick
        </h2>

        {!hasHistory ? (
          <EmptyState
            title="Noch keine Trainingsdaten"
            description="Sobald du deine erste Einheit abgeschlossen hast, erscheinen hier deine Wochenübersicht und die wichtigsten Kennzahlen. Alle Auswertungen entstehen ausschließlich aus deinen lokalen Daten."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Diese Woche"
                value={formatNumber(overview?.sessionsThisWeek)}
                hint="Trainingseinheiten"
                tone="accent"
              />
              <Stat
                label="Serie"
                value={formatNumber(overview?.analytics.streakWeeks)}
                hint="Wochen in Folge"
              />
              <Stat
                label="Arbeitssätze Wo."
                value={formatNumber(overview?.weekAnalytics.workingSetCount)}
                hint="diese Woche"
              />
              <Stat
                label="Cardio Wo."
                value={`${formatNumber(
                  Math.round(
                    (overview?.weekAnalytics.cardio.totalDurationSeconds ?? 0) / 60,
                  ),
                )} min`}
                hint="diese Woche"
              />
              <Stat
                label="30 Tage"
                value={formatNumber(overview?.analytics.sessionCount)}
                hint="Einheiten"
              />
              <Stat
                label="Volumen 30 T."
                value={formatVolume(overview?.analytics.volume.volumeKg)}
                hint="gewichtete Übungen"
              />
            </div>

            {overview?.lastSession ? (
              <Link
                to={`/verlauf/${overview.lastSession.id}`}
                className="mt-2 block rounded-2xl border border-border bg-surface p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Letzte Einheit
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
    </>
  );
}
