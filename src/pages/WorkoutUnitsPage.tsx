import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Copy,
  Dumbbell,
  Layers,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import {
  createWorkoutUnit,
  deleteWorkoutUnit,
  duplicateWorkoutUnit,
  addWorkoutUnitToPlan,
  listWorkoutUnitsWithExercises,
} from '@/db/repositories/workoutUnits';
import { listPlans } from '@/db/repositories/plans';
import { listExercises } from '@/db/repositories/exercises';
import { listImportedFingerprints } from '@/services/planPackage/import';
import {
  ActiveSessionExistsError,
  startSessionFromWorkoutUnit,
} from '@/db/repositories/sessions';
import {
  analyzeUnitPackageImport,
  importWorkoutUnitPackage,
  parseWorkoutUnitPackage,
  type UnitPackageImportPreview,
  type WorkoutUnitPackage,
} from '@/services/unitPackage';
import { summariseWorkoutUnit } from '@/services/workoutUnitSummary';
import { WorkoutUnitShareDialog } from '@/features/templates/WorkoutUnitShareDialog';
import { readFileAsText } from '@/utils/download';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useToast } from '@/hooks/useToast';
import { formatSets } from '@/utils/format';

/** Segmented links between the two library sub-areas. */
function LibraryTabs({ active }: { active: 'units' | 'exercises' }) {
  const base =
    'flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium transition-colors';
  return (
    <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1">
      <Link
        to="/bibliothek"
        aria-current={active === 'units' ? 'page' : undefined}
        className={`${base} ${active === 'units' ? 'bg-accent text-accent-contrast' : 'text-muted active:bg-surface-2'}`}
      >
        Übungseinheiten
      </Link>
      <Link
        to="/mehr/uebungen"
        aria-current={active === 'exercises' ? 'page' : undefined}
        className={`${base} ${active === 'exercises' ? 'bg-accent text-accent-contrast' : 'text-muted active:bg-surface-2'}`}
      >
        Übungen
      </Link>
    </div>
  );
}

export default function WorkoutUnitsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const activeSession = useActiveSession();
  const units = useLiveQuery(() => listWorkoutUnitsWithExercises(), [], undefined);
  const plans = useLiveQuery(() => listPlans(), [], []);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  /** Unit currently being added to a plan (opens the plan picker). */
  const [addToPlanId, setAddToPlanId] = useState<string | null>(null);
  const [shareUnitId, setShareUnitId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPkg, setImportPkg] = useState<WorkoutUnitPackage | null>(null);
  const [importPreview, setImportPreview] = useState<UnitPackageImportPreview | null>(
    null,
  );

  const handleCreate = async () => {
    const unit = await createWorkoutUnit({ name: newName, description: newDescription });
    setCreateOpen(false);
    setNewName('');
    setNewDescription('');
    navigate(`/bibliothek/${unit.id}`);
  };

  const handleStart = async (unitId: string) => {
    try {
      const session = await startSessionFromWorkoutUnit(unitId);
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
  };

  const handleAddToPlan = async (planId: string) => {
    if (!addToPlanId) return;
    const plan = plans.find((p) => p.id === planId);
    await addWorkoutUnitToPlan(addToPlanId, planId);
    setAddToPlanId(null);
    toast.show(`Zu „${plan?.name ?? 'Plan'}“ hinzugefügt.`, 'success');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportErrors([]);
    setImportPkg(null);
    setImportPreview(null);
    try {
      const result = parseWorkoutUnitPackage(await readFileAsText(file));
      if (!result.ok) {
        setImportErrors(result.errors);
        return;
      }
      const [exercises, fingerprints] = await Promise.all([
        listExercises(),
        listImportedFingerprints(),
      ]);
      setImportPkg(result.data);
      setImportPreview(analyzeUnitPackageImport(result.data, exercises, fingerprints));
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.',
      ]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPkg) return;
    const result = await importWorkoutUnitPackage(importPkg);
    setImportPkg(null);
    setImportPreview(null);
    toast.show(
      `${result.createdUnits} Einheit(en) importiert, ${result.createdExercises} neue Übungen.`,
      'success',
    );
  };

  return (
    <>
      <PageHeader
        title="Bibliothek"
        action={
          <div className="flex gap-1">
            <IconButton
              label="Übungseinheit importieren"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} aria-hidden="true" />
            </IconButton>
            <IconButton label="Neue Übungseinheit" onClick={() => setCreateOpen(true)}>
              <Plus size={22} aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleImportFile(event.target.files?.[0])}
      />

      <LibraryTabs active="units" />

      {units === undefined ? (
        <p className="text-center text-sm text-muted">Wird geladen …</p>
      ) : units.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} aria-hidden="true" />}
          title="Noch keine Übungseinheiten"
          description="Lege wiederverwendbare Einheiten wie „Push“, „Pull“ oder „Ganzkörper A“ an. Du kannst sie später zu Plänen hinzufügen oder direkt starten."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Übungseinheit anlegen
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {units.map(({ unit, exercises }) => {
            const summary = summariseWorkoutUnit(exercises);
            return (
              <li
                key={unit.id}
                className="rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{unit.name}</p>
                    <p className="text-xs text-muted">
                      {summary.exerciseCount} Übungen · {formatSets(summary.totalTargetSets)}
                    </p>
                    {summary.muscleGroups.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {summary.muscleGroups.slice(0, 4).map((group) => (
                          <span
                            key={group}
                            className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted"
                          >
                            {group}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={`„${unit.name}“ bearbeiten`}
                      onClick={() => navigate(`/bibliothek/${unit.id}`)}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`„${unit.name}“ duplizieren`}
                      onClick={async () => {
                        await duplicateWorkoutUnit(unit.id);
                        toast.show('Übungseinheit dupliziert.', 'success');
                      }}
                    >
                      <Copy size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`„${unit.name}“ teilen`}
                      onClick={() => setShareUnitId(unit.id)}
                    >
                      <Share2 size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`„${unit.name}“ löschen`}
                      onClick={() => setDeleteId(unit.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={Boolean(activeSession) || summary.exerciseCount === 0}
                    onClick={() => void handleStart(unit.id)}
                  >
                    <Play size={16} aria-hidden="true" />
                    Starten
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={plans.length === 0}
                    onClick={() => setAddToPlanId(unit.id)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Zu Plan hinzufügen
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Neue Übungseinheit"
      >
        <div className="grid gap-3">
          <TextField
            label="Name"
            value={newName}
            placeholder="z. B. Push"
            onChange={(event) => setNewName(event.target.value)}
          />
          <TextAreaField
            label="Beschreibung (optional)"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <Button variant="primary" fullWidth onClick={() => void handleCreate()}>
            Anlegen und bearbeiten
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={addToPlanId !== null}
        onClose={() => setAddToPlanId(null)}
        title="Zu welchem Plan hinzufügen?"
      >
        {plans.length === 0 ? (
          <p className="text-sm text-muted">Es gibt noch keinen Trainingsplan.</p>
        ) : (
          <ul className="grid gap-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => void handleAddToPlan(plan.id)}
                  className="flex min-h-[52px] w-full items-center gap-2 rounded-2xl border border-border bg-surface px-3 text-left font-medium active:bg-surface-2"
                >
                  <Dumbbell size={18} className="text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{plan.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <WorkoutUnitShareDialog unitId={shareUnitId} onClose={() => setShareUnitId(null)} />

      <Dialog
        open={importErrors.length > 0}
        onClose={() => setImportErrors([])}
        title="Import nicht möglich"
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-danger">
          {importErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={importPreview !== null}
        onClose={() => {
          setImportPkg(null);
          setImportPreview(null);
        }}
        title="Übungseinheiten importieren?"
      >
        {importPreview ? (
          <div className="grid gap-3">
            <p className="text-sm">
              {importPreview.unitNames.length} Einheit(en):{' '}
              <span className="text-muted">{importPreview.unitNames.join(', ')}</span>
            </p>
            <p className="text-sm text-muted">
              {importPreview.newExercises} neue Übungen, {importPreview.reusedExercises}{' '}
              werden wiederverwendet. Bestehende Einheiten und deine Historie bleiben
              unverändert.
            </p>
            {importPreview.alreadyImported ? (
              <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
                Diese Datei wurde bereits importiert. Ein erneuter Import legt Kopien an.
              </p>
            ) : null}
            <Button
              variant="primary"
              fullWidth
              onClick={() => void handleConfirmImport()}
            >
              Jetzt importieren
            </Button>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        destructive
        title="Übungseinheit löschen?"
        description="Die Einheit wird aus der Bibliothek entfernt. Bereits zu Plänen hinzugefügte Kopien und deine Trainingshistorie bleiben unverändert."
        confirmLabel="Löschen"
        onConfirm={async () => {
          if (deleteId) await deleteWorkoutUnit(deleteId);
          setDeleteId(null);
          toast.show('Übungseinheit gelöscht.', 'success');
        }}
      />
    </>
  );
}
