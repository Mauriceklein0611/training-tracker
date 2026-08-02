import { useRef, useState } from 'react';
import { ClipboardCopy, Download, FileJson, Share2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpButton } from '@/features/guide/HelpButton';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { db } from '@/db/db';
import { markBackupCreated } from '@/db/repositories/settings';
import { listBodyWeightEntries } from '@/db/repositories/bodyWeight';
import { listTemplatesWithExercises } from '@/db/repositories/templates';
import { listPlansWithDays } from '@/db/repositories/plans';
import { getActivePlanId, listUsagePeriods } from '@/db/repositories/planUsage';
import { getActiveDeload } from '@/db/repositories/planDeload';
import { getPlanScheduleView } from '@/db/repositories/schedules';
import { recordAiExport } from '@/db/repositories/aiAnalyses';
import { deleteTrainingHistory, resetAllData } from '@/db/repositories/maintenance';
import { uuid } from '@/utils/id';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import {
  backupFileName,
  createBackup,
  importBackup,
  preImportBackupFileName,
  parseBackupFile,
  type BackupCounts,
  type BackupFile,
  type ImportMode,
} from '@/services/backup';
import {
  AI_ANALYSIS_PROMPT,
  aiExportFileName,
  buildAiExport,
  buildContextBlock,
  buildPlansExport,
  buildTrainingBlockContext,
  DEFAULT_AI_EXPORT_OPTIONS,
  hasExportPeriodErrors,
  validateExportPeriod,
  type AiExportOptions,
  type ExportPeriodErrors,
  type AiExportPeriodKey,
} from '@/services/aiExport';
import { bodyWeightCsv, exercisesCsv, sessionsCsv, setsCsv } from '@/services/csv';
import { shareJsonExport } from '@/services/share';
import { parseNumberInput } from '@/services/validation';
import type { AnalysisContext, TrainingPhase } from '@/types';
import { loadAnalyticsDataset } from '@/services/dataset';
import {
  copyToClipboard,
  downloadCsv,
  downloadJson,
  readFileAsText,
} from '@/utils/download';
import { formatDateTime, todayKey } from '@/utils/date';

interface PendingImport {
  backup: BackupFile;
  counts: BackupCounts;
  warnings: string[];
  fileName: string;
}

export default function DataPage() {
  const { t } = useTranslation('data');
  const { t: tCommon } = useTranslation('common');
  const toast = useToast();
  const { settings, update } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [historyConfirm, setHistoryConfirm] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [aiOptions, setAiOptions] = useState<AiExportOptions>(DEFAULT_AI_EXPORT_OPTIONS);
  // Only shown after a failed attempt, so the form does not scold while typing.
  const [periodErrors, setPeriodErrors] = useState<ExportPeriodErrors>({});

  const localizePeriodErrors = (errors: ExportPeriodErrors): ExportPeriodErrors => ({
    customFrom:
      errors.customFrom === 'Bitte ein Startdatum wählen.'
        ? t('periodValidation.startRequired')
        : errors.customFrom
          ? t('periodValidation.invalidDate')
          : undefined,
    customTo:
      errors.customTo === 'Bitte ein Enddatum wählen.'
        ? t('periodValidation.endRequired')
        : errors.customTo === 'Das Enddatum darf nicht vor dem Startdatum liegen.'
          ? t('periodValidation.invalidOrder')
          : errors.customTo
            ? t('periodValidation.invalidDate')
            : undefined,
  });

  const localizeBackupMessage = (message: string) => {
    if (
      message ===
      'Die Datei ist keine gültige JSON-Datei und konnte nicht gelesen werden.'
    ) {
      return t('restore.invalidJson');
    }
    if (message.startsWith('Diese Datei wurde mit einem neueren Exportformat')) {
      return t('restore.newerExport');
    }
    if (message.startsWith('Diese Datei stammt aus einer neueren Datenbankversion')) {
      return t('restore.newerDatabase');
    }
    const orphanExercises = message.match(/^(\d+) Übungseinträge/);
    if (orphanExercises) {
      return t('restore.orphanExercises', { value: orphanExercises[1] });
    }
    if (message.startsWith('1 Satz verweist')) return t('restore.orphanSetOne');
    const orphanSets = message.match(/^(\d+) Sätze verweisen/);
    if (orphanSets) return t('restore.orphanSets', { value: orphanSets[1] });
    const activeSessions = message.match(
      /^Die Datei enthält (\d+) aktive Trainingseinheiten/,
    );
    if (activeSessions) {
      return t('restore.activeSessions', { value: activeSessions[1] });
    }
    return t('restore.invalidFile');
  };

  /** Merges one context field into the settings; empty strings are dropped. */
  const updateContext = async (changes: Partial<AnalysisContext>) => {
    const merged: AnalysisContext = { ...settings.analysisContext, ...changes };
    for (const [key, value] of Object.entries(merged)) {
      if (value === '' || value == null) delete merged[key as keyof AnalysisContext];
    }
    await update({
      analysisContext: Object.keys(merged).length > 0 ? merged : undefined,
    });
  };

  // ---- full backup ------------------------------------------------------
  const handleBackup = async () => {
    setBusy('backup');
    try {
      const backup = await createBackup();
      downloadJson(backupFileName(), backup);
      await markBackupCreated();
      toast.show(t('toast.backupCreated'), 'success');
    } catch (error) {
      toast.show(
        error instanceof Error
          ? t('toast.exportFailed', { detail: error.message })
          : t('toast.exportFailedGeneric'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  // ---- import -----------------------------------------------------------
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportErrors([]);
    setPending(null);
    try {
      const text = await readFileAsText(file);
      const result = parseBackupFile(text);
      if (!result.ok) {
        setImportErrors(result.errors);
        return;
      }
      setPending({
        backup: result.backup,
        counts: result.counts,
        warnings: result.warnings,
        fileName: file.name,
      });
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : t('toast.fileReadFailed'),
      ]);
    } finally {
      // Allow selecting the same file again after a failed attempt.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetKeyword = t('danger.resetKeyword');

  const handleDeleteHistory = async () => {
    setBusy('reset');
    try {
      await deleteTrainingHistory();
      setHistoryConfirm(false);
      toast.show(t('toast.historyDeleted'), 'success');
    } catch {
      toast.show(t('toast.deleteFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleResetAll = async () => {
    setBusy('reset');
    try {
      await resetAllData();
      // Only after the database reset succeeded: a controlled full reload, so no
      // stale React state (open session, cached queries) survives the wipe.
      window.location.assign('/');
    } catch {
      toast.show(t('toast.resetFailed'), 'error');
      setBusy(null);
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    setBusy('import');
    try {
      // A restorable safety copy is downloaded before either merge or replace.
      // It uses the exact released backup contract and never mutates the DB.
      const safetyBackup = await createBackup();
      downloadJson(preImportBackupFileName(), safetyBackup);
      await markBackupCreated();
      const result = await importBackup(pending.backup, mode);
      const added = Object.values(result.added).reduce((sum, value) => sum + value, 0);
      const skipped = Object.values(result.skipped).reduce(
        (sum, value) => sum + value,
        0,
      );
      toast.show(
        mode === 'replace'
          ? t('toast.dataReplaced', { value: added })
          : t('toast.dataMerged', { added, skipped }),
        'success',
      );
      setPending(null);
      setReplaceConfirm(false);
    } catch (error) {
      // The import runs in one transaction, so nothing was written on failure.
      toast.show(
        error instanceof Error
          ? t('toast.importFailed', { detail: error.message })
          : t('toast.importFailedGeneric'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  /** What the file will contain, listed before anything leaves the device. */
  const exportContents = [
    aiOptions.period === 'all'
      ? t('aiExport.contents.entireHistory')
      : aiOptions.period === 'custom'
        ? t('aiExport.contents.customPeriod', {
            from: aiOptions.customFrom || '?',
            to: aiOptions.customTo || '?',
          })
        : t('aiExport.contents.lastDays', {
            value: aiOptions.period === '30d' ? 30 : 90,
          }),
    t('aiExport.contents.training'),
    aiOptions.includeWarmupSets
      ? t('aiExport.contents.warmupIncluded')
      : t('aiExport.contents.warmupExcluded'),
    aiOptions.includeNotes
      ? t('aiExport.contents.notesIncluded')
      : t('aiExport.contents.notesExcluded'),
    aiOptions.includeBodyWeight
      ? t('aiExport.contents.bodyIncluded')
      : t('aiExport.contents.bodyExcluded'),
    buildContextBlock(settings.analysisContext)
      ? t('aiExport.contents.contextIncluded')
      : t('aiExport.contents.contextExcluded'),
    t('aiExport.contents.planning'),
  ];

  const buildExportFile = async () => {
    const [dataset, bodyWeight, templates, plansWithDays, activePlanId, usagePeriods] =
      await Promise.all([
        loadAnalyticsDataset(),
        aiOptions.includeBodyWeight ? listBodyWeightEntries() : Promise.resolve([]),
        listTemplatesWithExercises(),
        listPlansWithDays(),
        getActivePlanId(),
        listUsagePeriods(),
      ]);
    const planEntries = await Promise.all(
      plansWithDays.map(async ({ plan }) => ({
        plan,
        scheduleMode: (await getPlanScheduleView(plan.id)).schedule.mode,
        isActive: plan.id === activePlanId,
      })),
    );
    const activeDeload = activePlanId ? await getActiveDeload(activePlanId) : undefined;
    const trainingContext = buildTrainingBlockContext({
      plans: planEntries,
      usagePeriods,
      activeDeload,
    });
    const file = buildAiExport(
      dataset,
      bodyWeight,
      {
        ...aiOptions,
        context: settings.analysisContext,
        weeklyGoals: settings.weeklyGoals,
        exportId: uuid(),
      },
      new Date(),
      buildPlansExport(templates),
      trainingContext,
    );
    // Remember this export so a later response file can be tied back to it.
    await recordAiExport(file.exportId, file.sourceFingerprint);
    return file;
  };

  /**
   * Hands the export to the operating system's share sheet.
   *
   * Called straight from the tap, because iOS rejects `navigator.share` outside
   * a user gesture. Which apps the sheet offers is the OS's decision — the app
   * makes no promise about that.
   */
  const handleShareForAi = async () => {
    const errors = validateExportPeriod(aiOptions);
    setPeriodErrors(localizePeriodErrors(errors));
    if (hasExportPeriodErrors(errors)) {
      toast.show(t('toast.completePeriod'), 'error');
      return;
    }

    setBusy('share');
    try {
      const file = await buildExportFile();
      const result = await shareJsonExport({
        fileName: aiExportFileName(),
        data: file,
        title: t('aiExport.shareTitle'),
        textPrefix: AI_ANALYSIS_PROMPT,
      });
      const shareMessage =
        result.outcome === 'shared-file'
          ? t('aiExport.shareResult.sharedFile')
          : result.outcome === 'shared-text'
            ? t('aiExport.shareResult.sharedText')
            : result.outcome === 'cancelled'
              ? t('aiExport.shareResult.cancelled')
              : result.outcome === 'downloaded'
                ? result.copiedToClipboard
                  ? t('aiExport.shareResult.downloadedCopied')
                  : t('aiExport.shareResult.downloaded')
                : t('aiExport.shareResult.failed');
      toast.show(shareMessage, result.outcome === 'failed' ? 'error' : 'success');
    } catch (error) {
      toast.show(
        error instanceof Error
          ? t('toast.shareFailed', { detail: error.message })
          : t('toast.shareFailedGeneric'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  // ---- AI export --------------------------------------------------------
  const handleAiExport = async () => {
    // Validate before touching the database: an incomplete custom period must
    // never silently widen the export to the whole history.
    const errors = validateExportPeriod(aiOptions);
    setPeriodErrors(localizePeriodErrors(errors));
    if (hasExportPeriodErrors(errors)) {
      toast.show(t('toast.completePeriod'), 'error');
      return;
    }

    setBusy('ai');
    try {
      downloadJson(aiExportFileName(), await buildExportFile());
      toast.show(t('toast.aiExportCreated'), 'success');
    } catch (error) {
      toast.show(
        error instanceof Error
          ? t('toast.exportFailed', { detail: error.message })
          : t('toast.exportFailedGeneric'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  // ---- CSV --------------------------------------------------------------
  const handleCsv = async (kind: 'sessions' | 'sets' | 'exercises' | 'bodyweight') => {
    setBusy(`csv-${kind}`);
    try {
      const today = todayKey();
      if (kind === 'bodyweight') {
        downloadCsv(
          `training-koerperdaten-${today}.csv`,
          bodyWeightCsv(await listBodyWeightEntries()),
        );
      } else if (kind === 'exercises') {
        downloadCsv(
          `training-uebungen-${today}.csv`,
          exercisesCsv(await db.exercises.toArray()),
        );
      } else {
        const dataset = await loadAnalyticsDataset();
        downloadCsv(
          `training-${kind === 'sets' ? 'saetze' : 'einheiten'}-${today}.csv`,
          kind === 'sets' ? setsCsv(dataset) : sessionsCsv(dataset),
        );
      }
      toast.show(t('toast.csvCreated'), 'success');
    } catch (error) {
      toast.show(
        error instanceof Error
          ? t('toast.exportFailed', { detail: error.message })
          : t('toast.exportFailedGeneric'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        backTo="/mehr"
        action={<HelpButton articleId="backup-import" compact />}
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader title={t('backup.title')} subtitle={t('backup.subtitle')} as="h2" />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy !== null}
            onClick={() => void handleBackup()}
          >
            <Download size={20} aria-hidden="true" />
            {busy === 'backup' ? t('busy.creating') : t('backup.create')}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t('backup.last')}{' '}
            {settings.lastBackupAt
              ? formatDateTime(settings.lastBackupAt)
              : t('backup.never')}
            . {t('backup.localHint')}
          </p>
        </Card>

        <Card>
          <CardHeader
            title={t('restore.title')}
            subtitle={t('restore.subtitle')}
            as="h2"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void handleFileSelected(event.target.files?.[0])}
          />
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={busy !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} aria-hidden="true" />
            {t('restore.choose')}
          </Button>

          {importErrors.length > 0 ? (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-danger/50 bg-surface-2 p-3 text-sm"
            >
              <p className="font-semibold text-danger">
                <span aria-hidden="true">⚠ </span>
                {t('restore.unusable')}
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-xs leading-relaxed text-muted">
                {importErrors.map((message) => (
                  <li key={message}>{localizeBackupMessage(message)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title={t('aiExport.title')}
            subtitle={t('aiExport.subtitle')}
            as="h2"
          />
          <div className="grid gap-3">
            <SelectField
              label={t('aiExport.period.label')}
              value={aiOptions.period}
              onChange={(event) =>
                setAiOptions((current) => ({
                  ...current,
                  period: event.target.value as AiExportPeriodKey,
                }))
              }
            >
              <option value="all">{t('aiExport.period.all')}</option>
              <option value="30d">{t('aiExport.period.days30')}</option>
              <option value="90d">{t('aiExport.period.days90')}</option>
              <option value="custom">{t('aiExport.period.custom')}</option>
            </SelectField>

            {aiOptions.period === 'custom' ? (
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  label={t('aiExport.period.from')}
                  type="date"
                  required
                  value={aiOptions.customFrom ?? ''}
                  error={periodErrors.customFrom}
                  max={aiOptions.customTo || undefined}
                  onChange={(event) => {
                    setPeriodErrors({});
                    setAiOptions((current) => ({
                      ...current,
                      customFrom: event.target.value,
                    }));
                  }}
                />
                <TextField
                  label={t('aiExport.period.to')}
                  type="date"
                  required
                  value={aiOptions.customTo ?? ''}
                  error={periodErrors.customTo}
                  min={aiOptions.customFrom || undefined}
                  onChange={(event) => {
                    setPeriodErrors({});
                    setAiOptions((current) => ({
                      ...current,
                      customTo: event.target.value,
                    }));
                  }}
                />
              </div>
            ) : null}

            <CheckboxField
              label={t('aiExport.options.notes')}
              hint={t('aiExport.options.notesHint')}
              checked={aiOptions.includeNotes}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeNotes: checked }))
              }
            />
            <CheckboxField
              label={t('aiExport.options.body')}
              hint={t('aiExport.options.bodyHint')}
              checked={aiOptions.includeBodyWeight}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeBodyWeight: checked }))
              }
            />
            <CheckboxField
              label={t('aiExport.options.warmup')}
              hint={t('aiExport.options.warmupHint')}
              checked={aiOptions.includeWarmupSets}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeWarmupSets: checked }))
              }
            />

            {/* Stated plainly before anything can leave the device. */}
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs font-semibold">{t('aiExport.contents.heading')}</p>
              <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted">
                {exportContents.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t('aiExport.privacyHint')}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={busy !== null}
              onClick={() => void handleShareForAi()}
            >
              <Share2 size={20} aria-hidden="true" />
              {busy === 'share' ? t('busy.preparing') : t('aiExport.share')}
            </Button>

            <Button
              variant="secondary"
              fullWidth
              disabled={busy !== null}
              onClick={() => void handleAiExport()}
            >
              <FileJson size={18} aria-hidden="true" />
              {busy === 'ai' ? t('busy.creating') : t('aiExport.saveFile')}
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={async () => {
                const ok = await copyToClipboard(AI_ANALYSIS_PROMPT);
                toast.show(
                  ok ? t('toast.promptCopied') : t('toast.promptCopyBlocked'),
                  ok ? 'success' : 'error',
                );
              }}
            >
              <ClipboardCopy size={18} aria-hidden="true" />
              {t('aiExport.copyPrompt')}
            </Button>

            <details className="rounded-xl border border-border bg-surface-2 p-3">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-xs font-medium text-accent">
                {t('aiExport.showPrompt')}
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {AI_ANALYSIS_PROMPT}
              </p>
            </details>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('context.title')}
            subtitle={t('context.subtitle')}
            as="h2"
          />
          <details>
            <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
              {buildContextBlock(settings.analysisContext)
                ? t('context.edit')
                : t('context.add')}
            </summary>
            <div className="mt-3 grid gap-3">
              <TextField
                label={t('context.goal')}
                value={settings.analysisContext?.goal ?? ''}
                placeholder={t('context.goalPlaceholder')}
                onChange={(event) => void updateContext({ goal: event.target.value })}
              />
              <NumberField
                label={t('context.days')}
                value={String(settings.analysisContext?.trainingDaysPerWeekTarget ?? '')}
                placeholder={t('context.daysPlaceholder')}
                onChange={(event) => {
                  const parsed = parseNumberInput(event.target.value);
                  void updateContext({
                    trainingDaysPerWeekTarget:
                      parsed == null || Number.isNaN(parsed)
                        ? undefined
                        : Math.min(14, Math.max(1, Math.round(parsed))),
                  });
                }}
              />
              <TextAreaField
                label={t('context.equipment')}
                rows={2}
                value={settings.analysisContext?.equipment ?? ''}
                placeholder={t('context.equipmentPlaceholder')}
                onChange={(event) =>
                  void updateContext({ equipment: event.target.value })
                }
              />
              <SelectField
                label={t('context.phase')}
                value={settings.analysisContext?.phase ?? ''}
                onChange={(event) =>
                  void updateContext({
                    phase: (event.target.value || undefined) as TrainingPhase | undefined,
                  })
                }
              >
                <option value="">{t('context.phaseNone')}</option>
                <option value="bulk">{t('context.phaseBulk')}</option>
                <option value="maintenance">{t('context.phaseMaintenance')}</option>
                <option value="cut">{t('context.phaseCut')}</option>
              </SelectField>
              <TextAreaField
                label={t('context.limitations')}
                rows={2}
                value={settings.analysisContext?.limitations ?? ''}
                placeholder={t('context.limitationsPlaceholder')}
                onChange={(event) =>
                  void updateContext({ limitations: event.target.value })
                }
              />
              <TextAreaField
                label={t('context.focus')}
                rows={2}
                value={settings.analysisContext?.focus ?? ''}
                placeholder={t('context.focusPlaceholder')}
                onChange={(event) => void updateContext({ focus: event.target.value })}
              />
              <p className="text-xs leading-relaxed text-muted">
                {t('context.emptyHint')}
              </p>
            </div>
          </details>
        </Card>

        <Card>
          <CardHeader title={t('csv.title')} subtitle={t('csv.subtitle')} as="h2" />
          <div className="grid gap-2">
            <Button disabled={busy !== null} onClick={() => void handleCsv('sets')}>
              {t('csv.sets')}
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('sessions')}>
              {t('csv.sessions')}
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('exercises')}>
              {t('csv.exercises')}
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('bodyweight')}>
              {t('csv.body')}
            </Button>
          </div>
        </Card>

        <Card className="border-danger/40">
          <CardHeader title={t('danger.title')} subtitle={t('danger.subtitle')} as="h2" />
          <div className="grid gap-2">
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => setHistoryConfirm(true)}
            >
              {t('danger.deleteHistory')}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              {t('danger.deleteHistoryHint')}
            </p>
            <Button
              variant="danger"
              className="mt-2"
              disabled={busy !== null}
              onClick={() => setResetOpen(true)}
            >
              {t('danger.resetApp')}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              {t('danger.resetAppHint')}
            </p>
          </div>
        </Card>
      </div>

      {/* Import preview: the user sees exactly what the file contains first. */}
      <Dialog
        open={Boolean(pending) && !replaceConfirm}
        onClose={() => setPending(null)}
        title={t('importDialog.title')}
        description={
          pending ? t('importDialog.file', { name: pending.fileName }) : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {tCommon('action.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy !== null}
              onClick={() => void runImport('merge')}
            >
              {t('importDialog.merge')}
            </Button>
            <Button variant="danger" onClick={() => setReplaceConfirm(true)}>
              {t('importDialog.replace')}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t('importDialog.records')}</h3>
              <ul className="mt-1.5 grid gap-1 text-sm">
                {(Object.keys(pending.counts) as (keyof BackupCounts)[]).map((key) => (
                  <li key={key} className="flex justify-between gap-3">
                    <span className="text-muted">{t(`importDialog.counts.${key}`)}</span>
                    <span className="numeric font-medium">{pending.counts[key]}</span>
                  </li>
                ))}
              </ul>
            </div>

            {pending.warnings.length > 0 ? (
              <div className="rounded-xl border border-warning/50 bg-surface-2 p-3">
                <p className="text-sm font-semibold text-warning">
                  <span aria-hidden="true">⚠ </span>
                  {t('importDialog.notes')}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted">
                  {pending.warnings.map((warning) => (
                    <li key={warning}>{localizeBackupMessage(warning)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              <p className="mb-2">{t('importDialog.safetyBackup')}</p>
              <p>
                <span className="font-semibold text-text">
                  {t('importDialog.mergeLabel')}
                </span>{' '}
                {t('importDialog.mergeDescription')}
              </p>
              <p className="mt-1.5">
                <span className="font-semibold text-text">
                  {t('importDialog.replaceLabel')}
                </span>{' '}
                {t('importDialog.replaceDescription')}
              </p>
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={replaceConfirm}
        title={t('danger.replaceTitle')}
        description={t('danger.replaceDescription')}
        confirmLabel={t('danger.replaceConfirm')}
        cancelLabel={tCommon('action.cancel')}
        destructive
        onCancel={() => setReplaceConfirm(false)}
        onConfirm={() => void runImport('replace')}
      />

      <ConfirmDialog
        open={historyConfirm}
        title={t('danger.historyTitle')}
        description={t('danger.historyDescription')}
        confirmLabel={t('danger.historyConfirm')}
        cancelLabel={tCommon('action.cancel')}
        destructive
        onCancel={() => setHistoryConfirm(false)}
        onConfirm={() => void handleDeleteHistory()}
      />

      {/* Full reset requires typing a keyword, so it can never happen by accident. */}
      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetInput('');
        }}
        title={t('danger.resetTitle')}
        description={t('danger.resetDescription')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetOpen(false);
                setResetInput('');
              }}
            >
              {tCommon('action.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy !== null || resetInput.trim().toUpperCase() !== resetKeyword}
              onClick={() => void handleResetAll()}
            >
              {t('danger.deleteAll')}
            </Button>
          </>
        }
      >
        <TextField
          label={t('danger.resetInput', { keyword: resetKeyword })}
          value={resetInput}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder={resetKeyword}
          onChange={(event) => setResetInput(event.target.value)}
        />
      </Dialog>
    </>
  );
}
