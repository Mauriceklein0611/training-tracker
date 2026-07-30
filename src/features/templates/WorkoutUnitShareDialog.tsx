import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('library');
  const { t: tCommon } = useTranslation();
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
        title: t('share.systemTitle', { name: detail.unit.name }),
      });
      const message =
        result.outcome === 'shared-file'
          ? t('share.result.sharedFile')
          : result.outcome === 'shared-text'
            ? t('share.result.sharedText')
            : result.outcome === 'cancelled'
              ? t('share.result.cancelled')
              : result.outcome === 'downloaded'
                ? t(
                    result.copiedToClipboard
                      ? 'share.result.downloadedCopied'
                      : 'share.result.downloaded',
                  )
                : t('share.result.failed');
      toast.show(message, result.outcome === 'failed' ? 'error' : 'success');
    } catch {
      toast.show(t('share.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!detail) return;
    downloadJson(workoutUnitPackageFileName(), build());
    toast.show(t('share.saved'), 'success');
  };

  return (
    <Dialog open={unitId !== null} onClose={onClose} title={t('share.title')} size="lg">
      {detail ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">
            {t('share.description', {
              name: detail.unit.name,
              exercises: t(
                detail.exercises.length === 1
                  ? 'count.exerciseOne'
                  : 'count.exerciseOther',
                { count: detail.exercises.length },
              ),
            })}
          </p>
          <CheckboxField
            label={t('share.includeNotes')}
            checked={includeNotes}
            onChange={setIncludeNotes}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void handleShare()}>
              <Share2 size={18} aria-hidden="true" />
              {tCommon('action.share')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={handleDownload}>
              <Download size={18} aria-hidden="true" />
              {t('share.download')}
            </Button>
          </div>
          <p className="text-xs text-muted">{t('share.fallbackHint')}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{tCommon('state.loading')}</p>
      )}
    </Dialog>
  );
}
