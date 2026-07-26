import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CheckboxField } from '@/components/ui/Field';
import {
  getWorkoutUnitWithExercises,
  type WorkoutUnitWithExercises,
} from '@/db/repositories/workoutUnits';
import {
  buildWorkoutUnitPackage,
  workoutUnitPackageFileName,
} from '@/services/unitPackage';
import { shareJsonExport } from '@/services/share';
import { downloadJson } from '@/utils/download';
import { useToast } from '@/hooks/useToast';

/**
 * Shares a single library workout unit as a `training-workout-unit-package`.
 * Privacy is shown before anything leaves the device: no history, no body data,
 * no internal ids — only the unit, its exercises and targets, notes optional.
 */
export function WorkoutUnitShareDialog({
  unitId,
  onClose,
}: {
  unitId: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<WorkoutUnitWithExercises | null>(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!unitId) {
      setDetail(null);
      return;
    }
    void (async () => {
      const loaded = await getWorkoutUnitWithExercises(unitId);
      if (!cancelled) {
        setDetail(loaded ?? null);
        setIncludeNotes(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const build = () =>
    buildWorkoutUnitPackage(detail ? [detail] : [], {
      packageName: detail?.unit.name ?? 'Übungseinheit',
      source: 'app-export',
      includeNotes,
    });

  const handleShare = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await shareJsonExport({
        fileName: workoutUnitPackageFileName(),
        data: build(),
        title: `Übungseinheit „${detail.unit.name}" teilen`,
      });
      toast.show(result.message, result.outcome === 'failed' ? 'error' : 'success');
    } catch {
      toast.show('Teilen fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!detail) return;
    downloadJson(workoutUnitPackageFileName(), build());
    toast.show('Datei gespeichert.', 'success');
  };

  return (
    <Dialog
      open={unitId !== null}
      onClose={onClose}
      title="Übungseinheit teilen"
      size="lg"
    >
      {detail ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            „{detail.unit.name}" mit {detail.exercises.length} Übungen wird als portable
            Datei geteilt. Enthalten sind nur die Einheit, ihre Übungen und Zielwerte —
            keine Trainingshistorie, keine Körperdaten, keine internen IDs.
          </p>
          <CheckboxField
            label="Notizen mitgeben"
            checked={includeNotes}
            onChange={setIncludeNotes}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void handleShare()}>
              <Share2 size={18} aria-hidden="true" />
              Teilen
            </Button>
            <Button variant="secondary" disabled={busy} onClick={handleDownload}>
              <Download size={18} aria-hidden="true" />
              Herunterladen
            </Button>
          </div>
          <p className="text-xs text-muted">
            Falls Teilen nicht unterstützt wird, lädt die App die Datei stattdessen
            herunter — du kannst sie dann z. B. über WhatsApp versenden.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Wird geladen …</p>
      )}
    </Dialog>
  );
}
