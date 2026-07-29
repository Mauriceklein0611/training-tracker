import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ClipboardList,
  Copy,
  MoreVertical,
  Play,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { db } from '@/db/db';
import {
  deletePlan,
  duplicatePlan,
  listPlansWithDays,
  SPLIT_TYPE_LABELS,
  type PlanWithDays,
} from '@/db/repositories/plans';
import { getPlanScheduleState } from '@/db/repositories/schedules';
import { getActivePlanId } from '@/db/repositories/planUsage';
import { getActiveDeload } from '@/db/repositories/planDeload';
import { PLAN_GOAL_TYPE_LABELS } from '@/services/planGoals';
import {
  ActiveSessionExistsError,
  startSessionFromTemplate,
} from '@/db/repositories/sessions';
import { CreatePlanDialog } from '@/features/plans/CreatePlanDialog';
import { PlanPackageTools } from '@/features/plans/PlanPackageTools';
import { PlanShareDialog } from '@/features/plans/PlanShareDialog';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import type { TrainingPlan } from '@/types';

interface PlanOverview extends PlanWithDays {
  exerciseCount: number;
  nextDayId?: string;
  nextDayName?: string;
  /** Weekly plans: label of today's scheduled rest/free day, if today is one. */
  restToday?: string;
  isActive: boolean;
  deloadActive: boolean;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();

  const plans = useLiveQuery(
    async (): Promise<PlanOverview[]> => {
      const withDays = await listPlansWithDays();
      const rows = await db.templateExercises.toArray();
      const activePlanId = await getActivePlanId();
      const countByDay = new Map<string, number>();
      for (const row of rows) {
        countByDay.set(row.templateId, (countByDay.get(row.templateId) ?? 0) + 1);
      }
      return Promise.all(
        withDays.map(async (entry) => {
          const state = await getPlanScheduleState(entry.plan.id);
          const next = state.nextWorkout?.template;
          const restToday =
            state.mode === 'weekly' && state.current?.type === 'rest'
              ? (state.current.name ?? undefined)
              : undefined;
          const deload = await getActiveDeload(entry.plan.id);
          return {
            ...entry,
            exerciseCount: entry.days.reduce(
              (sum, day) => sum + (countByDay.get(day.id) ?? 0),
              0,
            ),
            nextDayId: next?.id,
            nextDayName: next?.name,
            restToday,
            isActive: entry.plan.id === activePlanId,
            deloadActive: deload != null,
          };
        }),
      );
    },
    [],
    [],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingPlan | null>(null);
  const [shareTarget, setShareTarget] = useState<PlanOverview | null>(null);
  // The plan whose overflow action sheet is open. Secondary actions live here so
  // they never compete with each card's single dominant start action.
  const [menuTarget, setMenuTarget] = useState<PlanOverview | null>(null);

  const handleStart = async (dayId: string) => {
    try {
      const session = await startSessionFromTemplate(dayId);
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
  };

  return (
    <>
      <PageHeader
        title="Pläne"
        action={
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            Neu
          </Button>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} aria-hidden="true" />}
          title="Noch keine Trainingspläne"
          description="Ein Plan besteht aus einem oder mehreren Trainingstagen (z. B. Push, Pull, Beine). Beim Start wird der vorgeschlagene Tag zu einer Trainingseinheit — ändern kannst du während des Trainings trotzdem alles."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Ersten Plan erstellen
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2">
          {plans.map((entry) => {
            const multiDay = entry.days.length > 1;
            return (
              <li
                key={entry.plan.id}
                className="min-w-0 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/plaene/${entry.plan.id}`} className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{entry.plan.name}</span>
                      {entry.isActive ? <Badge tone="accent">Aktiv</Badge> : null}
                      {entry.deloadActive ? <Badge tone="warning">Deload</Badge> : null}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {multiDay
                        ? `${SPLIT_TYPE_LABELS[entry.plan.splitType]} · ${entry.days.length} Tage`
                        : `${entry.exerciseCount} ${entry.exerciseCount === 1 ? 'Übung' : 'Übungen'}`}
                      {entry.plan.goalType
                        ? ` · ${PLAN_GOAL_TYPE_LABELS[entry.plan.goalType]}`
                        : ''}
                    </p>
                    {multiDay ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.days.slice(0, 4).map((day) => (
                          <span
                            key={day.id}
                            className={
                              day.name === entry.nextDayName
                                ? 'rounded-lg bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent'
                                : 'rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted'
                            }
                          >
                            {day.name}
                          </span>
                        ))}
                        {entry.days.length > 4 ? (
                          <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted">
                            +{entry.days.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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
                  <IconButton
                    label={`Aktionen für ${entry.plan.name}`}
                    className="shrink-0"
                    onClick={() => setMenuTarget(entry)}
                  >
                    <MoreVertical size={18} aria-hidden="true" />
                  </IconButton>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  className="mt-3"
                  disabled={Boolean(activeSession) || !entry.nextDayId}
                  onClick={() => entry.nextDayId && void handleStart(entry.nextDayId)}
                >
                  <Play size={18} aria-hidden="true" />
                  {activeSession
                    ? 'Training läuft bereits'
                    : multiDay
                      ? `„${entry.nextDayName}“ starten`
                      : 'Als Training starten'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <PlanPackageTools />
      </div>

      <CreatePlanDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(planId) => {
          setCreateOpen(false);
          navigate(`/plaene/${planId}`);
        }}
      />

      <Dialog
        open={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        title={menuTarget?.plan.name ?? ''}
        description="Plan verwalten"
      >
        <div className="grid gap-2">
          <Button
            variant="secondary"
            fullWidth
            className="justify-start"
            onClick={async () => {
              if (!menuTarget) return;
              const target = menuTarget;
              setMenuTarget(null);
              await duplicatePlan(target.plan.id);
              toast.show('Plan dupliziert.', 'success');
            }}
          >
            <Copy size={18} aria-hidden="true" />
            Duplizieren
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="justify-start"
            onClick={() => {
              setShareTarget(menuTarget);
              setMenuTarget(null);
            }}
          >
            <Share2 size={18} aria-hidden="true" />
            Teilen
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start text-danger"
            onClick={() => {
              setDeleteTarget(menuTarget?.plan ?? null);
              setMenuTarget(null);
            }}
          >
            <Trash2 size={18} aria-hidden="true" />
            Löschen
          </Button>
        </div>
      </Dialog>

      <PlanShareDialog
        planId={shareTarget ? shareTarget.plan.id : null}
        onClose={() => setShareTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Plan löschen?"
        description={`„${deleteTarget?.name ?? ''}“ wird mit allen Trainingstagen entfernt. Bereits absolvierte Trainingseinheiten bleiben vollständig erhalten.`}
        confirmLabel="Plan löschen"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deletePlan(deleteTarget.id);
          setDeleteTarget(null);
          toast.show('Plan gelöscht.', 'success');
        }}
      />
    </>
  );
}
