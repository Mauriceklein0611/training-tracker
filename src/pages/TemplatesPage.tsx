import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { db } from '@/db/db';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listTemplates,
  updateTemplate,
} from '@/db/repositories/templates';
import { ActiveSessionExistsError, startSessionFromTemplate } from '@/db/repositories/sessions';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import type { WorkoutTemplate } from '@/types';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();

  const templates = useLiveQuery(() => listTemplates(), [], []);
  const exerciseCounts = useLiveQuery(async () => {
    const rows = await db.templateExercises.toArray();
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.templateId, (counts.get(row.templateId) ?? 0) + 1);
    return counts;
  }, []);

  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkoutTemplate | null>(null);

  const openCreate = () => {
    setName('');
    setDescription('');
    setCreateOpen(true);
  };

  const openEdit = (template: WorkoutTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setEditing(template);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('Bitte gib einen Namen ein.', 'error');
      return;
    }
    if (editing) {
      await updateTemplate(editing.id, { name: trimmed, description: description.trim() });
      setEditing(null);
      toast.show('Plan gespeichert.', 'success');
    } else {
      const template = await createTemplate(trimmed, description.trim());
      setCreateOpen(false);
      navigate(`/plaene/${template.id}`);
    }
  };

  const handleStart = async (templateId: string) => {
    try {
      const session = await startSessionFromTemplate(templateId);
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
        title="Pläne"
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={18} aria-hidden="true" />
            Neu
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} aria-hidden="true" />}
          title="Noch keine Trainingspläne"
          description="Ein Plan legt fest, welche Übungen in welcher Reihenfolge trainiert werden, mit Ziel-Sätzen, Ziel-Wiederholungen und Pausenzeit. Beim Start wird daraus eine Trainingseinheit erzeugt — ändern kannst du während des Trainings trotzdem alles."
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus size={18} aria-hidden="true" />
              Ersten Plan erstellen
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2">
          {templates.map((template) => (
            <li key={template.id} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/plaene/${template.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="truncate text-sm text-muted">
                    {exerciseCounts?.get(template.id) ?? 0} Übungen
                    {template.description ? ` · ${template.description}` : ''}
                  </p>
                </Link>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={`${template.name} umbenennen`}
                    onClick={() => openEdit(template)}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`${template.name} duplizieren`}
                    onClick={async () => {
                      await duplicateTemplate(template.id);
                      toast.show('Plan dupliziert.', 'success');
                    }}
                  >
                    <Copy size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`${template.name} löschen`}
                    onClick={() => setDeleteTarget(template)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
              <Button
                variant="primary"
                fullWidth
                className="mt-3"
                disabled={Boolean(activeSession)}
                onClick={() => void handleStart(template.id)}
              >
                <Play size={18} aria-hidden="true" />
                {activeSession ? 'Training läuft bereits' : 'Als Training starten'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen || Boolean(editing)}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Plan umbenennen' : 'Neuer Trainingsplan'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
              }}
            >
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => void handleSave()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <TextField
            label="Name"
            value={name}
            placeholder="z. B. Oberkörper A"
            onChange={(event) => setName(event.target.value)}
          />
          <TextAreaField
            label="Beschreibung"
            value={description}
            placeholder="Optional"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Plan löschen?"
        description={`„${deleteTarget?.name ?? ''}“ wird entfernt. Bereits absolvierte Trainingseinheiten bleiben vollständig erhalten.`}
        confirmLabel="Plan löschen"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteTemplate(deleteTarget.id);
          setDeleteTarget(null);
          toast.show('Plan gelöscht.', 'success');
        }}
      />
    </>
  );
}
