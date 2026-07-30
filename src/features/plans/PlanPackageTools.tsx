import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCopy, FileJson, Share2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/Field';
import { listExercises } from '@/db/repositories/exercises';
import { listPlans } from '@/db/repositories/plans';
import { parsePlanPackage } from '@/services/planPackage/parse';
import type { PlanPackage } from '@/services/planPackage/schema';
import {
  analyzePlanPackageImport,
  importPlanPackage,
  listImportedFingerprints,
  planNameCollisions,
  type ExerciseResolution,
  type PlanPackageImportAnalysis,
} from '@/services/planPackage/import';
import {
  buildPlanBuilderKit,
  planBuilderKitFileName,
  PLAN_BUILDER_PROMPT,
} from '@/services/planPackage/builderKit';
import { shareJsonExport } from '@/services/share';
import { copyToClipboard, downloadJson, readFileAsText } from '@/utils/download';
import { useToast } from '@/hooks/useToast';
import { PLAN_PACKAGE_SCHEMA_VERSION } from '@/constants/formats';

/**
 * Tools to build a plan with AI or import a package. Rendered as a Card on the
 * "Pläne" page; pass `embedded` to drop the Card chrome when it already lives
 * inside a dialog (e.g. the home screen's "Trainingsplan importieren" modal).
 */
export function PlanPackageTools({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, i18n } = useTranslation('plans');
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pkg, setPkg] = useState<PlanPackage | null>(null);
  const [analysis, setAnalysis] = useState<PlanPackageImportAnalysis | null>(null);
  const [migratedFromVersion, setMigratedFromVersion] = useState<number | null>(null);

  // ---- builder kit ------------------------------------------------------
  const handleShareKit = async () => {
    setBusy('kit-share');
    try {
      const result = await shareJsonExport({
        fileName: planBuilderKitFileName(),
        data: buildPlanBuilderKit(),
        title: t('packageTools.createWithAi'),
        textPrefix: PLAN_BUILDER_PROMPT,
      });
      const message =
        result.outcome === 'shared-file'
          ? t('share.result.sharedFile')
          : result.outcome === 'shared-text'
            ? t('share.result.sharedText')
            : result.outcome === 'downloaded'
              ? t(
                  result.copiedToClipboard
                    ? 'share.result.downloadedCopied'
                    : 'share.result.downloaded',
                )
              : result.outcome === 'cancelled'
                ? t('share.result.cancelled')
                : t('share.result.failed');
      toast.show(message, result.outcome === 'failed' ? 'error' : 'success');
    } catch {
      toast.show(t('packageTools.shareFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadKit = () => {
    downloadJson(planBuilderKitFileName(), buildPlanBuilderKit());
    toast.show(t('packageTools.kitSaved'), 'success');
  };

  // ---- import -----------------------------------------------------------
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportErrors([]);
    setPkg(null);
    setAnalysis(null);
    setMigratedFromVersion(null);
    try {
      const text = await readFileAsText(file);
      const result = parsePlanPackage(text);
      if (!result.ok) {
        const isGerman = (i18n.resolvedLanguage ?? i18n.language).startsWith('de');
        setImportErrors(isGerman ? result.errors : [t('packageTools.invalidFormat')]);
        return;
      }
      const [exercises, plans, fingerprints] = await Promise.all([
        listExercises(),
        listPlans(),
        listImportedFingerprints(),
      ]);
      const analysisResult = analyzePlanPackageImport(
        result.data,
        exercises,
        plans.map((plan) => plan.name),
        fingerprints,
      );
      setMigratedFromVersion(result.migratedFromVersion ?? null);
      setPkg(result.data);
      setAnalysis(analysisResult);
    } catch {
      setImportErrors([t('packageTools.readFailed')]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setExerciseResolution = (exerciseKey: string, resolution: ExerciseResolution) => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((item) =>
              item.exerciseKey === exerciseKey ? { ...item, resolution } : item,
            ),
          }
        : current,
    );
  };

  const setPlanName = (planKey: string, name: string) => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            plans: current.plans.map((item) =>
              item.planKey === planKey ? { ...item, name } : item,
            ),
          }
        : current,
    );
  };

  const collisions = analysis ? planNameCollisions(analysis) : [];
  const hasEmptyPlanName = analysis?.plans.some((plan) => !plan.name.trim()) ?? false;
  const importWarnings = analysis
    ? [
        ...(migratedFromVersion
          ? [
              t('packageTools.migratedVersion', {
                version: migratedFromVersion,
              }),
            ]
          : []),
        ...(analysis.duplicate ? [t('packageTools.duplicateWarning')] : []),
        ...(analysis.unknownMuscleGroups.length > 0
          ? [
              t('packageTools.unknownMuscles', {
                groups: analysis.unknownMuscleGroups.join(', '),
              }),
            ]
          : []),
      ]
    : [];
  const differenceLabel = (difference: string): string => {
    if (difference === 'primäre Muskelgruppe')
      return t('packageTools.difference.primaryMuscle');
    if (difference === 'sekundäre Muskelgruppen')
      return t('packageTools.difference.secondaryMuscles');
    if (difference === 'Equipment') return t('packageTools.difference.equipment');
    if (difference === 'Pausenzeit') return t('packageTools.difference.rest');
    return t('packageTools.difference.other');
  };

  const handleImport = async () => {
    if (!pkg || !analysis) return;
    setBusy('import');
    try {
      const result = await importPlanPackage(pkg, analysis);
      toast.show(
        t('packageTools.importSuccess', {
          plans: result.createdPlans,
          planLabel: t(
            result.createdPlans === 1 ? 'packageTools.planOne' : 'packageTools.planOther',
          ),
          created: result.createdExercises,
          reused: result.reusedExercises,
        }),
        'success',
      );
      setPkg(null);
      setAnalysis(null);
      setMigratedFromVersion(null);
    } catch {
      // The import runs in one transaction — nothing was written on failure.
      toast.show(t('packageTools.importFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const panel = (
    <div className="grid gap-2">
      <Button variant="primary" fullWidth onClick={() => setBuilderOpen(true)}>
        <Sparkles size={18} aria-hidden="true" />
        {t('packageTools.createWithAi')}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => void handleFileSelected(event.target.files?.[0])}
      />
      <Button
        variant="secondary"
        fullWidth
        disabled={busy !== null}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={18} aria-hidden="true" />
        {t('packageTools.importFile')}
      </Button>

      {importErrors.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/50 bg-surface-2 p-3 text-sm"
        >
          <p className="font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            {t('packageTools.invalidFile')}
          </p>
          <ul className="mt-1.5 list-disc pl-5 text-xs leading-relaxed text-muted">
            {importErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {embedded ? (
        panel
      ) : (
        <Card>
          <CardHeader
            title={t('packageTools.cardTitle')}
            subtitle={t('packageTools.cardSubtitle')}
            as="h2"
          />
          {panel}
        </Card>
      )}

      {/* Builder kit: hand a self-describing file + prompt to ChatGPT. */}
      <Dialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={t('packageTools.createWithAi')}
        footer={
          <Button variant="secondary" onClick={() => setBuilderOpen(false)}>
            {t('packageTools.close')}
          </Button>
        }
      >
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed text-muted">
            {t('packageTools.builderDescription')}
          </p>
          <Button
            variant="primary"
            fullWidth
            disabled={busy !== null}
            onClick={() => void handleShareKit()}
          >
            <Share2 size={18} aria-hidden="true" />
            {busy === 'kit-share'
              ? t('packageTools.preparing')
              : t('packageTools.shareKit')}
          </Button>
          <Button variant="secondary" fullWidth onClick={handleDownloadKit}>
            <FileJson size={18} aria-hidden="true" />
            {t('packageTools.saveKit')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              const ok = await copyToClipboard(PLAN_BUILDER_PROMPT);
              toast.show(
                ok ? t('packageTools.instructionCopied') : t('packageTools.copyBlocked'),
                ok ? 'success' : 'error',
              );
            }}
          >
            <ClipboardCopy size={18} aria-hidden="true" />
            {t('packageTools.copyInstruction')}
          </Button>
          <details className="rounded-xl border border-border bg-surface-2 p-3">
            <summary className="min-h-[44px] cursor-pointer list-none py-2 text-xs font-medium text-accent">
              {t('packageTools.showInstruction')}
            </summary>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted">
              {t('packageTools.builderPromptDisplay', {
                version: PLAN_PACKAGE_SCHEMA_VERSION,
              })}
            </p>
          </details>
        </div>
      </Dialog>

      {/* Import preview with conflict resolution. */}
      <Dialog
        open={Boolean(analysis)}
        onClose={() => {
          setPkg(null);
          setAnalysis(null);
          setMigratedFromVersion(null);
        }}
        title={t('packageTools.importTitle')}
        description={
          analysis?.sourceLabel
            ? t('packageTools.source', { source: analysis.sourceLabel })
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPkg(null);
                setAnalysis(null);
                setMigratedFromVersion(null);
              }}
            >
              {t('packageTools.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy !== null || collisions.length > 0 || hasEmptyPlanName}
              onClick={() => void handleImport()}
            >
              {busy === 'import' ? t('packageTools.importing') : t('packageTools.import')}
            </Button>
          </>
        }
      >
        {analysis ? (
          <div className="grid gap-4">
            <p className="text-sm font-medium">{analysis.packageName}</p>

            {importWarnings.length > 0 ? (
              <div className="rounded-xl border border-warning/50 bg-surface-2 p-3">
                <p className="text-sm font-semibold text-warning">
                  <span aria-hidden="true">⚠ </span>
                  {t('packageTools.warnings')}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted">
                  {importWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold">
                {t('packageTools.plans', { count: analysis.plans.length })}
              </h3>
              <div className="mt-2 grid gap-2">
                {analysis.plans.map((plan) => (
                  <div key={plan.planKey} className="grid gap-1">
                    <TextField
                      label={t('packageTools.planLabel', {
                        name: plan.originalName,
                      })}
                      value={plan.name}
                      onChange={(event) => setPlanName(plan.planKey, event.target.value)}
                    />
                    {plan.nameConflict ? (
                      <p className="text-xs text-muted">
                        {t('packageTools.planNameConflict')}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted">
                      {t('packageTools.planSummary', {
                        days: plan.dayCount,
                        dayLabel: t(
                          plan.dayCount === 1
                            ? 'packageTools.dayOne'
                            : 'packageTools.dayOther',
                        ),
                        exercises: plan.exerciseCount,
                      })}
                    </p>
                  </div>
                ))}
              </div>
              {collisions.length > 0 ? (
                <p className="mt-1 text-xs text-danger">
                  {t('packageTools.duplicatePlanNames')}
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold">
                {t('packageTools.exercises', {
                  count: analysis.exercises.length,
                })}
              </h3>
              <ul className="mt-2 grid gap-2">
                {analysis.exercises.map((item) => (
                  <li key={item.exerciseKey} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm">{item.name}</span>
                      {item.status === 'reuse' || item.status === 'new' ? (
                        <span className="shrink-0 text-xs text-muted">
                          {t(`packageTools.status.${item.status}`)}
                        </span>
                      ) : null}
                    </div>
                    {item.status === 'conflict' || item.status === 'metadata-diff' ? (
                      <>
                        <SelectField
                          label={t('packageTools.resolutionLabel')}
                          value={item.resolution}
                          onChange={(event) =>
                            setExerciseResolution(
                              item.exerciseKey,
                              event.target.value as ExerciseResolution,
                            )
                          }
                        >
                          <option value="reuse">{t('packageTools.reuseExercise')}</option>
                          <option value="new-copy">
                            {t('packageTools.createExercise')}
                          </option>
                        </SelectField>
                        <p className="text-xs text-muted">
                          {item.status === 'conflict'
                            ? t('packageTools.trackingConflict')
                            : t('packageTools.differences', {
                                values: item.differences.map(differenceLabel).join(', '),
                              })}
                        </p>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              {t('packageTools.importSafety')}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
