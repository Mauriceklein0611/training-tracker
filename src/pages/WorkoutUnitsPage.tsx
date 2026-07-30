import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { muscleGroupDisplayLabel } from '@/constants/muscleGroups';
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
  const { t } = useTranslation('library');
  const base =
    'flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium transition-colors';
  return (
    <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1">
      <Link
        to="/bibliothek"
        aria-current={active === 'units' ? 'page' : undefined}
        className={`${base} ${active === 'units' ? 'bg-accent text-accent-contrast' : 'text-muted active:bg-surface-2'}`}
      >
        {t('tabs.units')}
      </Link>
      <Link
        to="/mehr/uebungen"
        aria-current={active === 'exercises' ? 'page' : undefined}
        className={`${base} ${active === 'exercises' ? 'bg-accent text-accent-contrast' : 'text-muted active:bg-surface-2'}`}
      >
        {t('tabs.exercises')}
      </Link>
    </div>
  );
}

export default function WorkoutUnitsPage() {
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation();
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
      toast.show(t('unit.startFailed'), 'error');
    }
  };

  const handleAddToPlan = async (planId: string) => {
    if (!addToPlanId) return;
    const plan = plans.find((p) => p.id === planId);
    await addWorkoutUnitToPlan(addToPlanId, planId);
    setAddToPlanId(null);
    toast.show(
      t('unit.addedToPlan', {
        name: plan?.name ?? t('planPicker.fallbackName'),
      }),
      'success',
    );
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
      setImportErrors([error instanceof Error ? error.message : t('import.readFailed')]);
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
      t('import.success', {
        units: t(result.createdUnits === 1 ? 'count.unitOne' : 'count.unitOther', {
          count: result.createdUnits,
        }),
        exercises: t(
          result.createdExercises === 1 ? 'count.exerciseOne' : 'count.exerciseOther',
          { count: result.createdExercises },
        ),
      }),
      'success',
    );
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <div className="flex gap-1">
            <IconButton
              label={t('unit.importAction')}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={22} aria-hidden="true" />
            </IconButton>
            <IconButton label={t('unit.create')} onClick={() => setCreateOpen(true)}>
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
        <p className="text-center text-sm text-muted">{tCommon('state.loading')}</p>
      ) : units.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} aria-hidden="true" />}
          title={t('unit.empty.title')}
          description={t('unit.empty.description')}
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              {t('unit.createAction')}
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
                      {t(
                        summary.exerciseCount === 1
                          ? 'count.exerciseOne'
                          : 'count.exerciseOther',
                        { count: summary.exerciseCount },
                      )}{' '}
                      · {formatSets(summary.totalTargetSets)}
                    </p>
                    {summary.muscleGroups.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {summary.muscleGroups.slice(0, 4).map((group) => (
                          <span
                            key={group}
                            className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted"
                          >
                            {muscleGroupDisplayLabel(group)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={t('unit.editAction', { name: unit.name })}
                      onClick={() => navigate(`/bibliothek/${unit.id}`)}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t('unit.duplicateAction', { name: unit.name })}
                      onClick={async () => {
                        await duplicateWorkoutUnit(unit.id);
                        toast.show(t('unit.duplicated'), 'success');
                      }}
                    >
                      <Copy size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t('unit.shareAction', { name: unit.name })}
                      onClick={() => setShareUnitId(unit.id)}
                    >
                      <Share2 size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t('unit.deleteAction', { name: unit.name })}
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
                    {t('unit.start')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={plans.length === 0}
                    onClick={() => setAddToPlanId(unit.id)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {t('unit.addToPlan')}
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
        title={t('unit.create')}
      >
        <div className="grid gap-3">
          <TextField
            label={t('field.name')}
            value={newName}
            placeholder={t('field.namePlaceholder')}
            onChange={(event) => setNewName(event.target.value)}
          />
          <TextAreaField
            label={t('field.descriptionOptional')}
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
          />
          <Button variant="primary" fullWidth onClick={() => void handleCreate()}>
            {t('unit.createAndEdit')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={addToPlanId !== null}
        onClose={() => setAddToPlanId(null)}
        title={t('planPicker.title')}
      >
        {plans.length === 0 ? (
          <p className="text-sm text-muted">{t('planPicker.empty')}</p>
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
        title={t('import.unavailableTitle')}
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
        title={t('import.confirmTitle')}
      >
        {importPreview ? (
          <div className="grid gap-3">
            <p className="text-sm">
              {t('import.previewUnits', {
                units: t(
                  importPreview.unitNames.length === 1
                    ? 'count.unitOne'
                    : 'count.unitOther',
                  { count: importPreview.unitNames.length },
                ),
              })}{' '}
              <span className="text-muted">{importPreview.unitNames.join(', ')}</span>
            </p>
            <p className="text-sm text-muted">
              {t('import.previewSummary', {
                newExercises: importPreview.newExercises,
                reusedExercises: importPreview.reusedExercises,
              })}
            </p>
            {importPreview.alreadyImported ? (
              <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
                {t('import.alreadyImported')}
              </p>
            ) : null}
            <Button
              variant="primary"
              fullWidth
              onClick={() => void handleConfirmImport()}
            >
              {t('import.confirm')}
            </Button>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        destructive
        title={t('unit.delete.title')}
        description={t('unit.delete.description')}
        confirmLabel={tCommon('action.delete')}
        onConfirm={async () => {
          if (deleteId) await deleteWorkoutUnit(deleteId);
          setDeleteId(null);
          toast.show(t('unit.delete.success'), 'success');
        }}
      />
    </>
  );
}
