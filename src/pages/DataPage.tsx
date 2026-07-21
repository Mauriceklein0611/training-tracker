import { useRef, useState } from 'react';
import { ClipboardCopy, Download, FileJson, Share2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import {
  BACKUP_COUNT_LABELS,
  backupFileName,
  createBackup,
  importBackup,
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
import { copyToClipboard, downloadCsv, downloadJson, readFileAsText } from '@/utils/download';
import { formatDateTime, todayKey } from '@/utils/date';

interface PendingImport {
  backup: BackupFile;
  counts: BackupCounts;
  warnings: string[];
  fileName: string;
}

export default function DataPage() {
  const toast = useToast();
  const { settings, update } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [aiOptions, setAiOptions] = useState<AiExportOptions>(DEFAULT_AI_EXPORT_OPTIONS);
  // Only shown after a failed attempt, so the form does not scold while typing.
  const [periodErrors, setPeriodErrors] = useState<ExportPeriodErrors>({});

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
      toast.show('Sicherung erstellt.', 'success');
    } catch (error) {
      toast.show(
        error instanceof Error
          ? `Export fehlgeschlagen: ${error.message}`
          : 'Export fehlgeschlagen.',
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
        error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.',
      ]);
    } finally {
      // Allow selecting the same file again after a failed attempt.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    setBusy('import');
    try {
      const result = await importBackup(pending.backup, mode);
      const added = Object.values(result.added).reduce((sum, value) => sum + value, 0);
      const skipped = Object.values(result.skipped).reduce((sum, value) => sum + value, 0);
      toast.show(
        mode === 'replace'
          ? `Daten ersetzt: ${added} Datensätze importiert.`
          : `Zusammengeführt: ${added} neu, ${skipped} bereits vorhanden.`,
        'success',
      );
      setPending(null);
      setReplaceConfirm(false);
    } catch (error) {
      // The import runs in one transaction, so nothing was written on failure.
      toast.show(
        error instanceof Error
          ? `Import fehlgeschlagen: ${error.message} Es wurden keine Daten verändert.`
          : 'Import fehlgeschlagen. Es wurden keine Daten verändert.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  /** What the file will contain, listed before anything leaves the device. */
  const exportContents = [
    aiOptions.period === 'all'
      ? 'gesamte Trainingshistorie'
      : aiOptions.period === 'custom'
        ? `Zeitraum ${aiOptions.customFrom || '?'} bis ${aiOptions.customTo || '?'}`
        : `letzte ${aiOptions.period === '30d' ? 30 : 90} Tage`,
    'Übungen, Sätze, Gewichte, Wiederholungen, Pausen',
    aiOptions.includeWarmupSets ? 'inklusive Aufwärmsätze' : 'ohne Aufwärmsätze',
    aiOptions.includeNotes ? 'inklusive Notizen' : 'ohne Notizen',
    aiOptions.includeBodyWeight ? 'inklusive Körperdaten' : 'ohne Körperdaten',
    buildContextBlock(settings.analysisContext)
      ? 'deine Angaben zum Trainingskontext'
      : 'keine Kontextangaben hinterlegt',
  ];

  const buildExportFile = async () => {
    const [dataset, bodyWeight] = await Promise.all([
      loadAnalyticsDataset(),
      aiOptions.includeBodyWeight ? listBodyWeightEntries() : Promise.resolve([]),
    ]);
    return buildAiExport(dataset, bodyWeight, {
      ...aiOptions,
      context: settings.analysisContext,
    });
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
    setPeriodErrors(errors);
    if (hasExportPeriodErrors(errors)) {
      toast.show('Bitte den Zeitraum vervollständigen.', 'error');
      return;
    }

    setBusy('share');
    try {
      const file = await buildExportFile();
      const result = await shareJsonExport({
        fileName: aiExportFileName(),
        data: file,
        title: 'Trainingsdaten zur Analyse',
        textPrefix: AI_ANALYSIS_PROMPT,
      });
      toast.show(result.message, result.outcome === 'failed' ? 'error' : 'success');
    } catch (error) {
      toast.show(
        error instanceof Error ? `Teilen fehlgeschlagen: ${error.message}` : 'Teilen fehlgeschlagen.',
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
    setPeriodErrors(errors);
    if (hasExportPeriodErrors(errors)) {
      toast.show('Bitte den Zeitraum vervollständigen.', 'error');
      return;
    }

    setBusy('ai');
    try {
      downloadJson(aiExportFileName(), await buildExportFile());
      toast.show('KI-Export erstellt.', 'success');
    } catch (error) {
      toast.show(
        error instanceof Error ? `Export fehlgeschlagen: ${error.message}` : 'Export fehlgeschlagen.',
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
        downloadCsv(`training-uebungen-${today}.csv`, exercisesCsv(await db.exercises.toArray()));
      } else {
        const dataset = await loadAnalyticsDataset();
        downloadCsv(
          `training-${kind === 'sets' ? 'saetze' : 'einheiten'}-${today}.csv`,
          kind === 'sets' ? setsCsv(dataset) : sessionsCsv(dataset),
        );
      }
      toast.show('CSV-Datei erstellt.', 'success');
    } catch (error) {
      toast.show(
        error instanceof Error ? `Export fehlgeschlagen: ${error.message}` : 'Export fehlgeschlagen.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Daten & Sicherung" backTo="/mehr" />

      <div className="grid gap-4">
        <Card>
          <CardHeader
            title="Vollständige Sicherung"
            subtitle="Enthält alle Übungen, Pläne, Trainingseinheiten, Sätze, Körpergewichtseinträge und Einstellungen. Diese Datei kann vollständig wieder eingespielt werden."
            as="h2"
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy !== null}
            onClick={() => void handleBackup()}
          >
            <Download size={20} aria-hidden="true" />
            {busy === 'backup' ? 'Wird erstellt …' : 'Vollständige Sicherung erstellen'}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Letzte Sicherung:{' '}
            {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'noch nie'}. Die
            Datei wird lokal erzeugt und nur dorthin gespeichert, wo du sie ablegst.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Sicherung wiederherstellen"
            subtitle="Wähle eine zuvor erstellte Sicherungsdatei. Sie wird zuerst geprüft — importiert wird erst nach deiner Bestätigung."
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
            Sicherungsdatei auswählen
          </Button>

          {importErrors.length > 0 ? (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-danger/50 bg-surface-2 p-3 text-sm"
            >
              <p className="font-semibold text-danger">
                <span aria-hidden="true">⚠ </span>
                Die Datei konnte nicht verwendet werden
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-xs leading-relaxed text-muted">
                {importErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Export für eine KI-Analyse"
            subtitle="Eine aufbereitete, selbsterklärende Datei für ChatGPT und vergleichbare Sprachmodelle. Sie enthält ausschließlich das, was du hier auswählst."
            as="h2"
          />
          <div className="grid gap-3">
            <SelectField
              label="Zeitraum"
              value={aiOptions.period}
              onChange={(event) =>
                setAiOptions((current) => ({
                  ...current,
                  period: event.target.value as AiExportPeriodKey,
                }))
              }
            >
              <option value="all">Gesamte Historie</option>
              <option value="30d">Letzte 30 Tage</option>
              <option value="90d">Letzte 90 Tage</option>
              <option value="custom">Benutzerdefiniert</option>
            </SelectField>

            {aiOptions.period === 'custom' ? (
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  label="Von"
                  type="date"
                  required
                  value={aiOptions.customFrom ?? ''}
                  error={periodErrors.customFrom}
                  max={aiOptions.customTo || undefined}
                  onChange={(event) => {
                    setPeriodErrors({});
                    setAiOptions((current) => ({ ...current, customFrom: event.target.value }));
                  }}
                />
                <TextField
                  label="Bis"
                  type="date"
                  required
                  value={aiOptions.customTo ?? ''}
                  error={periodErrors.customTo}
                  min={aiOptions.customFrom || undefined}
                  onChange={(event) => {
                    setPeriodErrors({});
                    setAiOptions((current) => ({ ...current, customTo: event.target.value }));
                  }}
                />
              </div>
            ) : null}

            <CheckboxField
              label="Notizen einschließen"
              hint="Notizen zu Trainings, Übungen und Körpergewicht."
              checked={aiOptions.includeNotes}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeNotes: checked }))
              }
            />
            <CheckboxField
              label="Körperdaten einschließen"
              hint="Gewicht, Körperfettanteil und Umfangsmaße."
              checked={aiOptions.includeBodyWeight}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeBodyWeight: checked }))
              }
            />
            <CheckboxField
              label="Aufwärmsätze einschließen"
              hint="Standardmäßig ausgeschlossen, damit Volumen und Bestleistungen nicht verfälscht werden."
              checked={aiOptions.includeWarmupSets}
              onChange={(checked) =>
                setAiOptions((current) => ({ ...current, includeWarmupSets: checked }))
              }
            />

            {/* Stated plainly before anything can leave the device. */}
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs font-semibold">Die Datei enthält:</p>
              <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted">
                {exportContents.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Die Datei wird lokal erzeugt. Beim Teilen entscheidet dein Gerät, welche Apps
                angeboten werden — die App überträgt selbst nichts.
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
              {busy === 'share' ? 'Wird vorbereitet …' : 'Mit KI analysieren'}
            </Button>

            <Button
              variant="secondary"
              fullWidth
              disabled={busy !== null}
              onClick={() => void handleAiExport()}
            >
              <FileJson size={18} aria-hidden="true" />
              {busy === 'ai' ? 'Wird erstellt …' : 'Nur als Datei speichern'}
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={async () => {
                const ok = await copyToClipboard(AI_ANALYSIS_PROMPT);
                toast.show(
                  ok
                    ? 'Analyseanweisung in die Zwischenablage kopiert.'
                    : 'Kopieren wurde vom Browser blockiert. Bitte markiere den Text manuell.',
                  ok ? 'success' : 'error',
                );
              }}
            >
              <ClipboardCopy size={18} aria-hidden="true" />
              Analyseanweisung kopieren
            </Button>

            <details className="rounded-xl border border-border bg-surface-2 p-3">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-xs font-medium text-accent">
                Anweisung anzeigen
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted">{AI_ANALYSIS_PROMPT}</p>
            </details>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Angaben zum Trainingskontext"
            subtitle="Vollständig freiwillig. Diese Angaben werden nur in den KI-Export übernommen und beeinflussen keine Berechnung in der App."
            as="h2"
          />
          <details>
            <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
              {buildContextBlock(settings.analysisContext)
                ? 'Angaben bearbeiten'
                : 'Angaben hinzufügen'}
            </summary>
            <div className="mt-3 grid gap-3">
              <TextField
                label="Trainingsziel"
                value={settings.analysisContext?.goal ?? ''}
                placeholder="z. B. Kraftaufbau im Oberkörper"
                onChange={(event) => void updateContext({ goal: event.target.value })}
              />
              <NumberField
                label="Gewünschte Trainingstage pro Woche"
                value={String(settings.analysisContext?.trainingDaysPerWeekTarget ?? '')}
                placeholder="z. B. 4"
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
                label="Verfügbares Equipment"
                rows={2}
                value={settings.analysisContext?.equipment ?? ''}
                placeholder="z. B. Langhantel, Kurzhanteln bis 30 kg, Klimmzugstange"
                onChange={(event) => void updateContext({ equipment: event.target.value })}
              />
              <SelectField
                label="Aktuelle Phase"
                value={settings.analysisContext?.phase ?? ''}
                onChange={(event) =>
                  void updateContext({
                    phase: (event.target.value || undefined) as TrainingPhase | undefined,
                  })
                }
              >
                <option value="">Keine Angabe</option>
                <option value="bulk">Aufbau</option>
                <option value="maintenance">Erhaltung</option>
                <option value="cut">Diät</option>
              </SelectField>
              <TextAreaField
                label="Einschränkungen oder Hinweise"
                rows={2}
                value={settings.analysisContext?.limitations ?? ''}
                placeholder="z. B. linke Schulter empfindlich beim Überkopfdrücken"
                onChange={(event) => void updateContext({ limitations: event.target.value })}
              />
              <TextAreaField
                label="Gewünschter Analyseschwerpunkt"
                rows={2}
                value={settings.analysisContext?.focus ?? ''}
                placeholder="z. B. Warum stagniert mein Bankdrücken?"
                onChange={(event) => void updateContext({ focus: event.target.value })}
              />
              <p className="text-xs leading-relaxed text-muted">
                Leere Felder erscheinen nicht in der Exportdatei.
              </p>
            </div>
          </details>
        </Card>

        <Card>
          <CardHeader
            title="CSV-Export"
            subtitle="Für Tabellenkalkulationen. UTF-8 mit korrekt maskierten Sonderzeichen."
            as="h2"
          />
          <div className="grid gap-2">
            <Button disabled={busy !== null} onClick={() => void handleCsv('sets')}>
              Sätze als CSV
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('sessions')}>
              Trainingseinheiten als CSV
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('exercises')}>
              Übungen als CSV
            </Button>
            <Button disabled={busy !== null} onClick={() => void handleCsv('bodyweight')}>
              Körperdaten als CSV
            </Button>
          </div>
        </Card>
      </div>

      {/* Import preview: the user sees exactly what the file contains first. */}
      <Dialog
        open={Boolean(pending) && !replaceConfirm}
        onClose={() => setPending(null)}
        title="Sicherung importieren"
        description={pending ? `Datei: ${pending.fileName}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={busy !== null}
              onClick={() => void runImport('merge')}
            >
              Zusammenführen
            </Button>
            <Button variant="danger" onClick={() => setReplaceConfirm(true)}>
              Ersetzen
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold">Enthaltene Datensätze</h3>
              <ul className="mt-1.5 grid gap-1 text-sm">
                {(Object.keys(pending.counts) as (keyof BackupCounts)[]).map((key) => (
                  <li key={key} className="flex justify-between gap-3">
                    <span className="text-muted">{BACKUP_COUNT_LABELS[key]}</span>
                    <span className="numeric font-medium">{pending.counts[key]}</span>
                  </li>
                ))}
              </ul>
            </div>

            {pending.warnings.length > 0 ? (
              <div className="rounded-xl border border-warning/50 bg-surface-2 p-3">
                <p className="text-sm font-semibold text-warning">
                  <span aria-hidden="true">⚠ </span>
                  Hinweise
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted">
                  {pending.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              <p>
                <span className="font-semibold text-text">Zusammenführen:</span> fügt nur
                Datensätze hinzu, die noch nicht vorhanden sind. Vorhandene Daten bleiben
                unverändert — nichts wird überschrieben.
              </p>
              <p className="mt-1.5">
                <span className="font-semibold text-text">Ersetzen:</span> löscht zuerst alle
                aktuellen Trainingsdaten auf diesem Gerät und spielt anschließend die Datei ein.
              </p>
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={replaceConfirm}
        title="Alle vorhandenen Daten ersetzen?"
        description="Sämtliche Übungen, Pläne, Trainingseinheiten, Sätze und Körpergewichtseinträge auf diesem Gerät werden gelöscht und durch den Inhalt der Datei ersetzt. Dieser Schritt kann nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung, wenn du dir nicht sicher bist."
        confirmLabel="Daten endgültig ersetzen"
        cancelLabel="Abbrechen"
        destructive
        onCancel={() => setReplaceConfirm(false)}
        onConfirm={() => void runImport('replace')}
      />
    </>
  );
}
