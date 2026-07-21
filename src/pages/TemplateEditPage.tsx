import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, GripVertical, Play, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { NumberField, TextField } from '@/components/ui/Field';
import {
  addExerciseToTemplate,
  getTemplateWithExercises,
  moveTemplateExercise,
  removeTemplateExercise,
  reorderTemplateExercises,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import { ActiveSessionExistsError, startSessionFromTemplate } from '@/db/repositories/sessions';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import { parseNumberInput } from '@/services/validation';
import { TRACKING_TYPE_LABELS } from '@/utils/format';

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
        <ol className="grid gap-3">
          {exercises.map((entry, index) => {
            const isDuration = entry.exercise?.trackingType === 'duration';
            return (
              <li
                key={entry.id}
                draggable
                onDragStart={() => setDragId(entry.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(entry.id)}
                onDragEnd={() => setDragId(null)}
                className="rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    size={20}
                    className="mt-1 hidden shrink-0 cursor-grab text-muted sm:block"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="text-muted">{index + 1}. </span>
                      {entry.exercise?.name ?? 'Gelöschte Übung'}
                    </p>
                    <p className="text-xs text-muted">
                      {entry.exercise
                        ? TRACKING_TYPE_LABELS[entry.exercise.trackingType]
                        : 'Diese Übung existiert nicht mehr.'}
                    </p>
                  </div>
                  {/*
                   * Buttons are the primary reordering mechanism: drag and drop
                   * is unreliable on touch and unusable with a keyboard.
                   */}
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={`${entry.exercise?.name ?? 'Übung'} nach oben`}
                      disabled={index === 0}
                      onClick={() => void moveTemplateExercise(entry.id, -1)}
                    >
                      <ArrowUp size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`${entry.exercise?.name ?? 'Übung'} nach unten`}
                      disabled={index === exercises.length - 1}
                      onClick={() => void moveTemplateExercise(entry.id, 1)}
                    >
                      <ArrowDown size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`${entry.exercise?.name ?? 'Übung'} entfernen`}
                      onClick={() => void removeTemplateExercise(entry.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <NumberField
                    label="Sätze"
                    value={String(entry.targetSets)}
                    onChange={(event) =>
                      void updateTemplateExercise(entry.id, {
                        targetSets: Math.max(1, Math.round(parseNumberInput(event.target.value) ?? 1)),
                      })
                    }
                  />
                  <NumberField
                    label="Pause (s)"
                    value={String(entry.restSeconds)}
                    onChange={(event) =>
                      void updateTemplateExercise(entry.id, {
                        restSeconds: Math.max(0, Math.round(parseNumberInput(event.target.value) ?? 0)),
                      })
                    }
                  />
                  {isDuration ? (
                    <NumberField
                      label="Zieldauer (s)"
                      containerClassName="col-span-2"
                      value={String(entry.targetDurationSeconds ?? '')}
                      onChange={(event) =>
                        void updateTemplateExercise(entry.id, {
                          targetDurationSeconds:
                            parseNumberInput(event.target.value) == null
                              ? undefined
                              : Math.max(0, Math.round(parseNumberInput(event.target.value) ?? 0)),
                        })
                      }
                    />
                  ) : (
                    <>
                      <NumberField
                        label="Wdh. von"
                        value={String(entry.targetRepMin ?? '')}
                        onChange={(event) =>
                          void updateTemplateExercise(entry.id, {
                            targetRepMin:
                              parseNumberInput(event.target.value) == null
                                ? undefined
                                : Math.max(0, Math.round(parseNumberInput(event.target.value) ?? 0)),
                          })
                        }
                      />
                      <NumberField
                        label="Wdh. bis"
                        value={String(entry.targetRepMax ?? '')}
                        onChange={(event) =>
                          void updateTemplateExercise(entry.id, {
                            targetRepMax:
                              parseNumberInput(event.target.value) == null
                                ? undefined
                                : Math.max(0, Math.round(parseNumberInput(event.target.value) ?? 0)),
                          })
                        }
                      />
                    </>
                  )}
                  <TextField
                    label="Notiz"
                    containerClassName="col-span-2"
                    value={entry.notes}
                    placeholder="Optional"
                    onChange={(event) =>
                      void updateTemplateExercise(entry.id, { notes: event.target.value })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ol>
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
