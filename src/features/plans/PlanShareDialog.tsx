import { useEffect, useState } from 'react';
import { Download, FileJson, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CheckboxField, TextField } from '@/components/ui/Field';
import { getTemplateWithExercises } from '@/db/repositories/templates';
import type { TemplateWithExercises } from '@/db/repositories/templates';
import { buildPlanPackage, planPackageFileName } from '@/services/planPackage/build';
import { shareJsonExport } from '@/services/share';
import { downloadJson } from '@/utils/download';
import { useToast } from '@/hooks/useToast';

/**
 * Shares one or more plans as a `training-plan-package`. Privacy options are
 * shown *before* anything leaves the device: the package never contains
 * training history, body data or internal ids — only the plans and the exercise
 * definitions they use, and notes only if the user keeps them.
 */
export function PlanShareDialog({
  templateIds,
  onClose,
}: {
  /** Plans to share; `null` keeps the dialog closed. */
  templateIds: string[] | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<TemplateWithExercises[]>([]);
  const [packageName, setPackageName] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!templateIds) {
      setEntries([]);
      return;
    }
    void (async () => {
      const loaded = (
        await Promise.all(templateIds.map((id) => getTemplateWithExercises(id)))
      ).filter((entry): entry is TemplateWithExercises => entry != null);
      if (cancelled) return;
      setEntries(loaded);
      setPackageName(
        loaded.length === 1 ? loaded[0].template.name : 'Meine Trainingspläne',
      );
      setIncludeNotes(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateIds]);

  const build = () =>
    buildPlanPackage(entries, {
      packageName: packageName.trim() || 'Trainingsplan',
      source: 'app-export',
      includeNotes,
    });

  const handleShare = async () => {
    setBusy(true);
    try {
      const pkg = build();
      const result = await shareJsonExport({
        fileName: planPackageFileName(pkg.packageName),
        data: pkg,
        title: pkg.packageName,
      });
      toast.show(result.message, result.outcome === 'failed' ? 'error' : 'success');
      if (result.outcome !== 'cancelled' && result.outcome !== 'failed') onClose();
    } catch (error) {
      toast.show(
        error instanceof Error
          ? `Teilen fehlgeschlagen: ${error.message}`
          : 'Teilen fehlgeschlagen.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    setBusy(true);
    try {
      const pkg = build();
      downloadJson(planPackageFileName(pkg.packageName), pkg);
      toast.show('Datei gespeichert.', 'success');
      onClose();
    } catch (error) {
      toast.show(
        error instanceof Error
          ? `Export fehlgeschlagen: ${error.message}`
          : 'Export fehlgeschlagen.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const exerciseCount = new Set(
    entries.flatMap((entry) =>
      entry.exercises.map((row) => row.exercise?.id).filter(Boolean),
    ),
  ).size;

  return (
    <Dialog
      open={Boolean(templateIds)}
      onClose={onClose}
      title={entries.length === 1 ? 'Plan teilen' : 'Pläne teilen'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="secondary"
            disabled={busy || entries.length === 0}
            onClick={handleDownload}
          >
            <FileJson size={18} aria-hidden="true" />
            Als Datei
          </Button>
          <Button
            variant="primary"
            disabled={busy || entries.length === 0}
            onClick={() => void handleShare()}
          >
            <Share2 size={18} aria-hidden="true" />
            Teilen
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Name des Pakets"
          value={packageName}
          onChange={(event) => setPackageName(event.target.value)}
        />
        <CheckboxField
          label="Notizen einschließen"
          hint="Notizen zu Plänen und Übungen. Ohne Haken bleiben sie auf deinem Gerät."
          checked={includeNotes}
          onChange={setIncludeNotes}
        />
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold">Das Paket enthält:</p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted">
            <li>
              {entries.length} {entries.length === 1 ? 'Plan' : 'Pläne'} mit{' '}
              {exerciseCount} Übungsdefinitionen
            </li>
            <li>keine Trainingshistorie, keine Körperdaten, keine internen IDs</li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-xs leading-relaxed text-muted">
            <Download size={13} aria-hidden="true" />
            Die Datei wird lokal erzeugt. Beim Teilen entscheidet dein Gerät, welche Apps
            angeboten werden — die App überträgt selbst nichts.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
