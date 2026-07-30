import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileJson, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CheckboxField, TextField } from '@/components/ui/Field';
import { getTemplateWithExercises } from '@/db/repositories/templates';
import type { TemplateWithExercises } from '@/db/repositories/templates';
import { getPlanWithDays } from '@/db/repositories/plans';
import { getPlanScheduleView } from '@/db/repositories/schedules';
import {
  buildPlanPackage,
  planPackageFileName,
  type PlanExportInput,
} from '@/services/planPackage/build';
import { shareJsonExport } from '@/services/share';
import { downloadJson } from '@/utils/download';
import { useToast } from '@/hooks/useToast';

/**
 * Shares a plan (with all its days) as a `training-plan-package`. Privacy
 * options are shown *before* anything leaves the device: the package never
 * contains training history, body data or internal ids — only the plan, its
 * days and the exercise definitions they use, and notes only if the user keeps
 * them.
 */
export function PlanShareDialog({
  planId,
  onClose,
}: {
  /** Plan to share; `null` keeps the dialog closed. */
  planId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('plans');
  const toast = useToast();
  const [input, setInput] = useState<PlanExportInput | null>(null);
  const [packageName, setPackageName] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!planId) {
      setInput(null);
      return;
    }
    void (async () => {
      const plan = await getPlanWithDays(planId);
      if (cancelled || !plan) return;
      const days = (
        await Promise.all(plan.days.map((day) => getTemplateWithExercises(day.id)))
      ).filter((entry): entry is TemplateWithExercises => entry != null);
      const view = await getPlanScheduleView(planId);
      if (cancelled) return;
      setInput({
        plan: plan.plan,
        days,
        schedule: { schedule: view.schedule, entries: view.entries },
      });
      setPackageName(plan.plan.name);
      setIncludeNotes(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const build = () =>
    buildPlanPackage(input ? [input] : [], {
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
      if (result.outcome !== 'cancelled' && result.outcome !== 'failed') onClose();
    } catch {
      toast.show(t('share.shareFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    setBusy(true);
    try {
      const pkg = build();
      downloadJson(planPackageFileName(pkg.packageName), pkg);
      toast.show(t('share.saved'), 'success');
      onClose();
    } catch {
      toast.show(t('share.exportFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const dayCount = input?.days.length ?? 0;
  const exerciseCount = new Set(
    (input?.days ?? []).flatMap((day) =>
      day.exercises.map((row) => row.exercise?.id).filter(Boolean),
    ),
  ).size;

  return (
    <Dialog
      open={Boolean(planId)}
      onClose={onClose}
      title={t('share.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('share.cancel')}
          </Button>
          <Button variant="secondary" disabled={busy || !input} onClick={handleDownload}>
            <FileJson size={18} aria-hidden="true" />
            {t('share.asFile')}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !input}
            onClick={() => void handleShare()}
          >
            <Share2 size={18} aria-hidden="true" />
            {t('share.action')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label={t('share.packageName')}
          value={packageName}
          onChange={(event) => setPackageName(event.target.value)}
        />
        <CheckboxField
          label={t('share.includeNotes')}
          hint={t('share.includeNotesHint')}
          checked={includeNotes}
          onChange={setIncludeNotes}
        />
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold">{t('share.contentsTitle')}</p>
          <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed text-muted">
            <li>
              {t('share.contentsSummary', {
                days: dayCount,
                dayLabel: t(dayCount === 1 ? 'share.dayOne' : 'share.dayOther'),
                exercises: exerciseCount,
              })}
            </li>
            <li>{t('share.privacySummary')}</li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-xs leading-relaxed text-muted">
            <Download size={13} aria-hidden="true" />
            {t('share.localHint')}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
