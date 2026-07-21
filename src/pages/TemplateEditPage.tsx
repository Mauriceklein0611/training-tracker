import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import {
  addExerciseToTemplate,
  getTemplateWithExercises,
  reorderTemplateExercises,
} from '@/db/repositories/templates';
import { ActiveSessionExistsError, startSessionFromTemplate } from '@/db/repositories/sessions';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { TemplateExerciseRow } from '@/features/templates/TemplateExerciseRow';
import { TemplateGroupHeader } from '@/features/templates/TemplateGroupHeader';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import {
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  groupItems,
  memberLabel,
} from '@/services/grouping';

export default function TemplateEditPage() {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();

  const data = useLiveQuery(() => getTemplateWithExercises(templateId), [templateId]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <>
        <PageHeader title="Plan" backTo="/plaene" />
        <p className="text-sm text-muted" role="status">
          Wird geladen …
        </p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Plan" backTo="/plaene" />
        <EmptyState
          title="Plan nicht gefunden"
          description="Dieser Trainingsplan existiert nicht mehr."
          action={
            <Button variant="primary" onClick={() => navigate('/plaene')}>
              Zurück zur Übersicht
            </Button>
          }
        />
      </>
    );
  }

  const { template, exercises } = data;
  const blocks = groupItems(exercises);
  const indexById = new Map(exercises.map((entry, index) => [entry.id, index]));

  /** Drop handler for the pointer-based reordering path. */
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = exercises.map((entry) => entry.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    await reorderTemplateExercises(template.id, ids);
    setDragId(null);
  };

  const handleStart = async () => {
    try {
      const session = await startSessionFromTemplate(template.id);
      navigate(`/training/${session.id}`);
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        navigate(`/training/${error.activeSessionId}`);
        return;
      }
      toast.show(error instanceof Error ? error.message : 'Start fehlgeschlagen.', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={template.name}
        subtitle={template.description || `${exercises.length} Übungen`}
        backTo="/plaene"
        action={
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            Übung
          </Button>
        }
      />

      {exercises.length === 0 ? (
        <EmptyState
          title="Noch keine Übungen im Plan"
          description="Füge Übungen hinzu und lege Ziel-Sätze, Ziel-Wiederholungen und die Pausenzeit fest. Die Reihenfolge kannst du jederzeit mit den Pfeiltasten oder per Ziehen ändern."
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Übung hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {blocks.map((block) => {
            const rows = block.members.map((entry, memberIndex) => (
              <TemplateExerciseRow
                key={entry.id}
                entry={entry}
                exercise={entry.exercise}
                label={memberLabel(block, memberIndex)}
                globalIndex={indexById.get(entry.id) ?? 0}
                total={exercises.length}
                grouped={block.groupId != null}
                canGroupWithPrevious={(indexById.get(entry.id) ?? 0) > 0}
                onDragStart={() => setDragId(entry.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(entry.id)}
                onDragEnd={() => setDragId(null)}
              />
            ));

            if (block.groupId == null) return rows;

            return (
              <div
                key={block.key}
                className="rounded-2xl border border-accent/40 bg-surface-2/40 p-2"
              >
                <TemplateGroupHeader
                  templateId={template.id}
                  groupId={block.groupId}
                  letter={block.letter}
                  groupType={block.groupType ?? DEFAULT_GROUP_TYPE}
                  groupRestMode={block.groupRestMode ?? DEFAULT_GROUP_REST_MODE}
                  memberCount={block.members.length}
                />
                <div className="grid gap-2">{rows}</div>
              </div>
            );
          })}
        </div>
      )}

      {exercises.length > 0 ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          disabled={Boolean(activeSession)}
          onClick={() => void handleStart()}
        >
          <Play size={20} aria-hidden="true" />
          {activeSession ? 'Training läuft bereits' : 'Als Training starten'}
        </Button>
      ) : null}

      <ExercisePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={async (exercise) => {
          await addExerciseToTemplate(template.id, exercise);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
