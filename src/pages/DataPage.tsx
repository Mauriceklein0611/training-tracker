import { useRef, useState } from 'react';
import { ClipboardCopy, Download, FileJson, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { CheckboxField, SelectField, TextField } from '@/components/ui/Field';
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
  DEFAULT_AI_EXPORT_OPTIONS,
  type AiExportOptions,
  type AiExportPeriodKey,
} from '@/services/aiExport';
import { bodyWeightCsv, exercisesCsv, sessionsCsv, setsCsv } from '@/services/csv';
import { loadAnalyticsDataset } from '@/services/dataset';
import { copyToClipboard, downloadCsv, downloadJson, readFileAsText } from '@/utils/download';
import { formatDateTime } from '@/utils/date';

interface PendingImport {
  backup: BackupFile;
  counts: BackupCounts;
  warnings: string[];
  fileName: string;
}

export default function DataPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [aiOptions, setAiOptions] = useState<AiExportOptions>(DEFAULT_AI_EXPORT_OPTIONS);

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

  // ---- AI export --------------------------------------------------------
  const handleAiExport = async () => {
    setBusy('ai');
    try {
      const [dataset, bodyWeight] = await Promise.all([
        loadAnalyticsDataset(),
        aiOptions.includeBodyWeight ? listBodyWeightEntries() : Promise.resolve([]),
      ]);
      const file = buildAiExport(dataset, bodyWeight, aiOptions);
      downloadJson(aiExportFileName(), file);
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
      const today = new Date().toISOString().slice(0, 10);
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
                  value={aiOptions.customFrom ?? ''}
                  onChange={(event) =>
                    setAiOptions((current) => ({ ...current, customFrom: event.target.value }))
                  }
                />
                <TextField
                  label="Bis"
                  type="date"
                  value={aiOptions.customTo ?? ''}
                  onChange={(event) =>
                    setAiOptions((current) => ({ ...current, customTo: event.target.value }))
                  }
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

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={busy !== null}
              onClick={() => void handleAiExport()}
            >
              <FileJson size={20} aria-hidden="true" />
              {busy === 'ai' ? 'Wird erstellt …' : 'Daten für KI exportieren'}
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
