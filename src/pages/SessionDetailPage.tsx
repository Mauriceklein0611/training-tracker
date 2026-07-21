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
import { SessionSummaryView } from '@/features/session/SessionSummaryView';
import { SetEditDialog } from '@/features/history/SetEditDialog';
import { loadAnalyticsDataset } from '@/services/dataset';
import { summarizeSession } from '@/services/sessionSummary';
import { useToast } from '@/hooks/useToast';
import type { SessionExercise, WorkoutSet } from '@/types';
import { formatDateTime } from '@/utils/date';

export default function SessionDetailPage() {
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
        <PageHeader title="Trainingseinheit" backTo="/verlauf" />
        <p className="text-sm text-muted" role="status">
          Wird geladen …
        </p>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <PageHeader title="Trainingseinheit" backTo="/verlauf" />
        <EmptyState
          title="Einheit nicht gefunden"
          description="Diese Trainingseinheit existiert nicht mehr."
          action={
            <Button variant="primary" onClick={() => navigate('/verlauf')}>
              Zurück zum Verlauf
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
        toast.show('Es läuft bereits eine Trainingseinheit.', 'error');
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(error instanceof Error ? error.message : 'Start fehlgeschlagen.', 'error');
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
        <div className="mb-4">
          <SessionSummaryView summary={summary} />
        </div>
      ) : null}

      <section className="mb-4 grid gap-3" aria-label="Einheit bearbeiten">
        <TextField
          label="Name der Einheit"
          value={name ?? detail.session.name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name != null && name.trim()) void updateSession(sessionId, { name: name.trim() });
          }}
        />
        <TextAreaField
          label="Notiz"
          value={notes ?? detail.session.notes}
          placeholder="Optional"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes != null) void updateSession(sessionId, { notes });
          }}
        />
      </section>

      <h2 className="mb-2 text-base font-semibold">Übungen und Sätze</h2>
      {detail.exercises.length === 0 ? (
        <EmptyState
          title="Keine Übungen erfasst"
          description="In dieser Einheit wurden keine Sätze gespeichert."
        />
      ) : (
        <div className="grid gap-3">
          {detail.exercises.map((entry) => (
            <section
              key={entry.sessionExercise.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <h3 className="font-medium">{entry.sessionExercise.exerciseNameSnapshot}</h3>
              {entry.sessionExercise.notes ? (
                <p className="mt-1 text-sm text-muted">{entry.sessionExercise.notes}</p>
              ) : null}
              <ul className="mt-2 grid gap-1">
                {entry.sets.map((set) => (
                  <li key={set.id}>
                    {/* Tapping a set opens the correction dialog. */}
                    <CompletedSetRow
                      set={set}
                      sessionExercise={entry.sessionExercise}
                      onEdit={() => setEditing({ set, sessionExercise: entry.sessionExercise })}
                    />
                  </li>
                ))}
              </ul>
              {entry.sets.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Keine Sätze erfasst.</p>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Button variant="primary" size="lg" onClick={() => void handleRepeat()}>
          <Play size={20} aria-hidden="true" />
          Neues Training auf dieser Basis
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            const copy = await duplicateSession(sessionId);
            toast.show('Einheit dupliziert.', 'success');
            navigate(`/verlauf/${copy.id}`);
          }}
        >
          <Copy size={18} aria-hidden="true" />
          Einheit duplizieren
        </Button>
        <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={18} aria-hidden="true" />
          Einheit löschen
        </Button>
      </div>

      <SetEditDialog
        set={editing?.set ?? null}
        sessionExercise={editing?.sessionExercise ?? null}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Trainingseinheit löschen?"
        description="Alle Sätze und Notizen dieser Einheit werden endgültig gelöscht. Deine Auswertungen ändern sich dadurch sofort."
        confirmLabel="Endgültig löschen"
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteSession(sessionId);
          setDeleteOpen(false);
          toast.show('Einheit gelöscht.', 'info');
          navigate('/verlauf', { replace: true });
        }}
      />
    </>
  );
}
