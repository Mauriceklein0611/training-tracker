import { useRef, useState } from 'react';
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

const EXERCISE_STATUS_LABEL: Record<string, string> = {
  reuse: 'Vorhandene Übung wird verwendet',
  new: 'Wird neu angelegt',
};

/**
 * Tools to build a plan with AI or import a package. Rendered as a Card on the
 * "Pläne" page; pass `embedded` to drop the Card chrome when it already lives
 * inside a dialog (e.g. the home screen's "Trainingsplan importieren" modal).
 */
export function PlanPackageTools({ embedded = false }: { embedded?: boolean } = {}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pkg, setPkg] = useState<PlanPackage | null>(null);
  const [analysis, setAnalysis] = useState<PlanPackageImportAnalysis | null>(null);

  // ---- builder kit ------------------------------------------------------
  const handleShareKit = async () => {
    setBusy('kit-share');
    try {
      const result = await shareJsonExport({
        fileName: planBuilderKitFileName(),
        data: buildPlanBuilderKit(),
        title: 'Trainingsplan mit KI erstellen',
        textPrefix: PLAN_BUILDER_PROMPT,
      });
      toast.show(result.message, result.outcome === 'failed' ? 'error' : 'success');
    } catch {
      toast.show('Teilen fehlgeschlagen.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadKit = () => {
    downloadJson(planBuilderKitFileName(), buildPlanBuilderKit());
    toast.show('Builder-Kit gespeichert.', 'success');
  };

  // ---- import -----------------------------------------------------------
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportErrors([]);
    setPkg(null);
    setAnalysis(null);
    try {
      const text = await readFileAsText(file);
      const result = parsePlanPackage(text);
      if (!result.ok) {
        setImportErrors(result.errors);
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
      if (result.migratedFromVersion) {
        analysisResult.warnings.unshift(
          `Ältere Paketversion (v${result.migratedFromVersion}) erkannt — sie wird als Plan mit einem Tag übernommen.`,
        );
      }
      setPkg(result.data);
      setAnalysis(analysisResult);
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : 'Die Datei konnte nicht gelesen werden.',
      ]);
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

  const handleImport = async () => {
    if (!pkg || !analysis) return;
    setBusy('import');
    try {
      const result = await importPlanPackage(pkg, analysis);
      toast.show(
        `Import abgeschlossen: ${result.createdPlans} ${
          result.createdPlans === 1 ? 'Plan' : 'Pläne'
        }, ${result.createdExercises} neue Übungen, ${result.reusedExercises} wiederverwendet.`,
        'success',
      );
      setPkg(null);
      setAnalysis(null);
    } catch (error) {
      // The import runs in one transaction — nothing was written on failure.
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

  const panel = (
    <div className="grid gap-2">
      <Button variant="primary" fullWidth onClick={() => setBuilderOpen(true)}>
        <Sparkles size={18} aria-hidden="true" />
        Mit KI Trainingsplan erstellen
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
        Trainingsplan-Datei importieren
      </Button>

      {importErrors.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/50 bg-surface-2 p-3 text-sm"
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
    </div>
  );

  return (
    <>
      {embedded ? (
        panel
      ) : (
        <Card>
          <CardHeader
            title="Plan mit KI erstellen oder importieren"
            subtitle="Erstelle mit ChatGPT einen Plan im passenden Format oder importiere ein geteiltes Trainingsplan-Paket. Beim Import wird nichts überschrieben — vorhandene Übungen werden wiederverwendet."
            as="h2"
          />
          {panel}
        </Card>
      )}

      {/* Builder kit: hand a self-describing file + prompt to ChatGPT. */}
      <Dialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title="Mit KI Trainingsplan erstellen"
        footer={
          <Button variant="secondary" onClick={() => setBuilderOpen(false)}>
            Schließen
          </Button>
        }
      >
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Teile die Builder-Datei zusammen mit dem Text an ChatGPT. Die KI stellt dir
            zuerst Fragen und baut den Plan mit dir. Am Ende bittest du sie, die Datei zu
            erstellen — diese importierst du hier wieder.
          </p>
          <Button
            variant="primary"
            fullWidth
            disabled={busy !== null}
            onClick={() => void handleShareKit()}
          >
            <Share2 size={18} aria-hidden="true" />
            {busy === 'kit-share'
              ? 'Wird vorbereitet …'
              : 'Builder-Kit & Anleitung teilen'}
          </Button>
          <Button variant="secondary" fullWidth onClick={handleDownloadKit}>
            <FileJson size={18} aria-hidden="true" />
            Nur Builder-Kit speichern
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              const ok = await copyToClipboard(PLAN_BUILDER_PROMPT);
              toast.show(
                ok
                  ? 'Anleitung in die Zwischenablage kopiert.'
                  : 'Kopieren wurde vom Browser blockiert. Bitte markiere den Text manuell.',
                ok ? 'success' : 'error',
              );
            }}
          >
            <ClipboardCopy size={18} aria-hidden="true" />
            Anleitung kopieren
          </Button>
          <details className="rounded-xl border border-border bg-surface-2 p-3">
            <summary className="min-h-[44px] cursor-pointer list-none py-2 text-xs font-medium text-accent">
              Anleitung anzeigen
            </summary>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted">
              {PLAN_BUILDER_PROMPT}
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
        }}
        title="Trainingsplan importieren"
        description={
          analysis?.sourceLabel ? `Quelle: ${analysis.sourceLabel}` : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPkg(null);
                setAnalysis(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={busy !== null || collisions.length > 0 || hasEmptyPlanName}
              onClick={() => void handleImport()}
            >
              {busy === 'import' ? 'Wird importiert …' : 'Importieren'}
            </Button>
          </>
        }
      >
        {analysis ? (
          <div className="grid gap-4">
            <p className="text-sm font-medium">{analysis.packageName}</p>

            {analysis.warnings.length > 0 ? (
              <div className="rounded-xl border border-warning/50 bg-surface-2 p-3">
                <p className="text-sm font-semibold text-warning">
                  <span aria-hidden="true">⚠ </span>
                  Hinweise
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted">
                  {analysis.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold">Pläne ({analysis.plans.length})</h3>
              <div className="mt-2 grid gap-2">
                {analysis.plans.map((plan) => (
                  <div key={plan.planKey} className="grid gap-1">
                    <TextField
                      label={`Plan „${plan.originalName}"`}
                      value={plan.name}
                      onChange={(event) => setPlanName(plan.planKey, event.target.value)}
                    />
                    {plan.nameConflict ? (
                      <p className="text-xs text-muted">
                        Ein Plan mit diesem Namen existiert bereits — Name wurde
                        angepasst.
                      </p>
                    ) : null}
                    <p className="text-xs text-muted">
                      {plan.dayCount} {plan.dayCount === 1 ? 'Tag' : 'Tage'} ·{' '}
                      {plan.exerciseCount} Übungen
                    </p>
                  </div>
                ))}
              </div>
              {collisions.length > 0 ? (
                <p className="mt-1 text-xs text-danger">
                  Zwei Pläne haben denselben Namen. Bitte vergib eindeutige Namen.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold">
                Übungen ({analysis.exercises.length})
              </h3>
              <ul className="mt-2 grid gap-2">
                {analysis.exercises.map((item) => (
                  <li key={item.exerciseKey} className="grid gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm">{item.name}</span>
                      {item.status === 'reuse' || item.status === 'new' ? (
                        <span className="shrink-0 text-xs text-muted">
                          {EXERCISE_STATUS_LABEL[item.status]}
                        </span>
                      ) : null}
                    </div>
                    {item.status === 'conflict' || item.status === 'metadata-diff' ? (
                      <>
                        <SelectField
                          label="Wie importieren?"
                          value={item.resolution}
                          onChange={(event) =>
                            setExerciseResolution(
                              item.exerciseKey,
                              event.target.value as ExerciseResolution,
                            )
                          }
                        >
                          <option value="reuse">Vorhandene Übung verwenden</option>
                          <option value="new-copy">Als neue Übung anlegen</option>
                        </SelectField>
                        <p className="text-xs text-muted">
                          {item.status === 'conflict'
                            ? 'Gleicher Name, aber abweichendes Tracking. Standard: neu anlegen.'
                            : `Unterschiede: ${item.differences.join(', ')}.`}
                        </p>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              Vorhandene Daten werden nie überschrieben. Der Import läuft in einem Schritt
              — schlägt er fehl, bleibt alles unverändert.
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
