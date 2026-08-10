import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Play, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import {
  ActiveSessionExistsError,
  deleteSession,
  duplicateSession,
  getSessionDetail,
  startSessionFromPreviousSession,
  updateSession,
} from '@/db/repositories/sessions';
import { CompletedSetRow } from '@/features/session/SetEditor';
import { PostCheckInCard, PreCheckInCard } from '@/features/checkin/CheckInCards';
import { SessionSummaryView } from '@/features/session/SessionSummaryView';
import { ShareResultButton } from '@/features/session/ShareResultButton';
import { SetEditDialog } from '@/features/history/SetEditDialog';
import { loadAnalyticsDataset } from '@/services/dataset';
import { summarizeSession } from '@/services/sessionSummary';
import { useToast } from '@/hooks/useToast';
import type { SessionExercise, WorkoutSet } from '@/types';
import { formatDateTime } from '@/utils/date';
import { useTranslation } from 'react-i18next';

export default function SessionDetailPage() {
  const { t } = useTranslation('history');
  const { t: tCommon } = useTranslation('common');
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const detail = useLiveQuery(() => getSessionDetail(sessionId), [sessionId]);
  const summary = useLiveQuery(async () => {
    const dataset = await loadAnalyticsDataset();
    return summarizeSession(dataset, sessionId);
  }, [sessionId]);

  const [editing, setEditing] = useState<{
    set: WorkoutSet;
    sessionExercise: SessionExercise;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  if (detail === undefined) {
    return (
      <>
        <PageHeader title={t('detail.pageTitle')} backTo="/verlauf" />
        <p className="text-sm text-muted" role="status">
          {tCommon('state.loading')}
        </p>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <PageHeader title={t('detail.pageTitle')} backTo="/verlauf" />
        <EmptyState
          title={t('detail.notFound.title')}
          description={t('detail.notFound.description')}
          action={
            <Button variant="primary" onClick={() => navigate('/verlauf')}>
              {t('detail.notFound.back')}
            </Button>
          }
        />
      </>
    );
  }

  const handleRepeat = async () => {
    try {
      const session = await startSessionFromPreviousSession(sessionId);
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        toast.show(t('detail.start.active'), 'error');
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(t('detail.start.failed'), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={detail.session.name}
        subtitle={formatDateTime(detail.session.startedAt)}
        backTo="/verlauf"
      />

      {summary ? (
        <div className="mb-4 grid gap-3">
          <SessionSummaryView summary={summary} />
          <ShareResultButton summary={summary} />
        </div>
      ) : null}

      <section className="mb-4 grid gap-3" aria-label={t('detail.edit.aria')}>
        <TextField
          label={t('detail.edit.name')}
          value={name ?? detail.session.name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name != null && name.trim())
              void updateSession(sessionId, { name: name.trim() });
          }}
        />
        <TextAreaField
          label={t('detail.edit.note')}
          value={notes ?? detail.session.notes}
          placeholder={t('detail.edit.optional')}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes != null) void updateSession(sessionId, { notes });
          }}
        />
      </section>

      <div className="mb-4 grid gap-3">
        <PreCheckInCard sessionId={sessionId} value={detail.session.preCheckIn} />
        <PostCheckInCard sessionId={sessionId} value={detail.session.postCheckIn} />
      </div>

      <h2 className="mb-2 text-base font-semibold">{t('detail.exercises.title')}</h2>
      {detail.exercises.length === 0 ? (
        <EmptyState
          title={t('detail.exercises.emptyTitle')}
          description={t('detail.exercises.emptyDescription')}
        />
      ) : (
        <div className="grid gap-3">
          {detail.exercises.map((entry) => (
            <section
              key={entry.sessionExercise.id}
              className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-surface p-3"
            >
              <h3 className="break-words font-medium">
                {entry.sessionExercise.exerciseNameSnapshot}
              </h3>
              {entry.sessionExercise.notes ? (
                <p className="mt-1 break-words text-sm text-muted">
                  {entry.sessionExercise.notes}
                </p>
              ) : null}
              <ul className="mt-2 grid gap-1">
                {entry.sets.map((set) => (
                  <li key={set.id}>
                    {/* Tapping a set opens the correction dialog. */}
                    <CompletedSetRow
                      set={set}
                      sessionExercise={entry.sessionExercise}
                      onEdit={() =>
                        setEditing({ set, sessionExercise: entry.sessionExercise })
                      }
                    />
                  </li>
                ))}
              </ul>
              {entry.sets.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t('detail.exercises.noSets')}</p>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Button variant="primary" size="lg" onClick={() => void handleRepeat()}>
          <Play size={20} aria-hidden="true" />
          {t('detail.action.repeat')}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const copy = await duplicateSession(sessionId);
            toast.show(t('detail.toast.duplicated'), 'success');
            navigate(`/verlauf/${copy.id}`);
          }}
        >
          <Copy size={18} aria-hidden="true" />
          {t('detail.action.duplicate')}
        </Button>
        <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={18} aria-hidden="true" />
          {t('detail.action.delete')}
        </Button>
      </div>

      <SetEditDialog
        set={editing?.set ?? null}
        sessionExercise={editing?.sessionExercise ?? null}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t('detail.deleteDialog.title')}
        description={t('detail.deleteDialog.description')}
        confirmLabel={t('detail.deleteDialog.confirm')}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteSession(sessionId);
          setDeleteOpen(false);
          toast.show(t('detail.toast.deleted'), 'info');
          navigate('/verlauf', { replace: true });
        }}
      />
    </>
  );
}
