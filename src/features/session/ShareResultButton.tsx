import { useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { CheckboxField } from '@/components/ui/Field';
import { useToast } from '@/hooks/useToast';
import type { SessionSummary } from '@/services/sessionSummary';
import {
  buildShareCardSvg,
  shareImage,
  svgDataUrl,
  svgToPngBlob,
  type ShareCardInput,
} from '@/services/shareCard';
import {
  formatCardioDistance,
  formatDuration,
  formatPace,
} from '@/services/cardioMetrics';
import { formatDate, formatDurationLong } from '@/utils/date';
import { formatNumber, formatVolume } from '@/utils/format';
import { useTranslation } from 'react-i18next';

/** Builds the card input from a summary, honouring the include toggles. */
function toInput(
  summary: SessionSummary,
  includeRecords: boolean,
  labels: {
    duration: string;
    workingSets: string;
    volume: string;
    cardioTime: string;
    distance: string;
    averagePace: string;
    averageRpe: string;
  },
): ShareCardInput {
  const stats: { label: string; value: string }[] = [];
  if (summary.durationSeconds != null) {
    stats.push({
      label: labels.duration,
      value: formatDurationLong(summary.durationSeconds),
    });
  }
  if (summary.hasStrength) {
    stats.push({
      label: labels.workingSets,
      value: formatNumber(summary.workingSetCount),
    });
    stats.push({ label: labels.volume, value: formatVolume(summary.volume.volumeKg) });
  }
  if (summary.hasCardio) {
    stats.push({
      label: labels.cardioTime,
      value: formatDuration(summary.cardio.totalDurationSeconds),
    });
    if (summary.cardio.totalDistanceMeters > 0) {
      stats.push({
        label: labels.distance,
        value: formatCardioDistance(
          summary.cardio.totalDistanceMeters,
          summary.cardioModality,
        ),
      });
    }
    if (summary.cardioPace) {
      stats.push({ label: labels.averagePace, value: formatPace(summary.cardioPace) });
    }
    if (summary.cardioAvgRpe != null) {
      stats.push({
        label: labels.averageRpe,
        value: formatNumber(summary.cardioAvgRpe, 1),
      });
    }
  }

  // Only a real improvement (something to beat) is highlighted — never a
  // first-time baseline.
  const record = includeRecords
    ? summary.newRecords.find((entry) => entry.previousValue != null)
    : undefined;
  return {
    title: summary.session.name,
    subtitle: formatDate(summary.session.startedAt),
    stats,
    highlight: record ? `${record.label}: ${record.exerciseName}` : undefined,
  };
}

/**
 * "Ergebnis teilen": builds a local result graphic, shows a preview, and shares
 * it via the OS (Web Share API) or a download. Body weight and measurements are
 * never part of the card; the only optional content is the personal-best line,
 * which the user can switch off before sharing.
 */
export function ShareResultButton({ summary }: { summary: SessionSummary }) {
  const { t } = useTranslation('session');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [includeRecords, setIncludeRecords] = useState(true);
  const [busy, setBusy] = useState(false);

  const hasRecords = summary.newRecords.length > 0;
  const svg = useMemo(
    () =>
      buildShareCardSvg(
        toInput(summary, includeRecords && hasRecords, {
          duration: t('share.duration'),
          workingSets: t('share.workingSets'),
          volume: t('share.volume'),
          cardioTime: t('share.cardioTime'),
          distance: t('share.distance'),
          averagePace: t('share.averagePace'),
          averageRpe: t('share.averageRpe'),
        }),
      ),
    [summary, includeRecords, hasRecords, t],
  );

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(svg);
      const outcome = await shareImage(blob, 'training-ergebnis.png');
      if (outcome === 'downloaded') toast.show(t('share.saved'), 'success');
      else if (outcome === 'failed') toast.show(t('share.failed'), 'error');
    } catch {
      toast.show(t('share.generationFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        <Share2 size={18} aria-hidden="true" />
        {t('share.action')}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('share.title')}
        description={t('share.description')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('share.close')}
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void handleShare()}>
              <Share2 size={18} aria-hidden="true" />
              {busy ? t('share.creating') : t('share.share')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <img
            src={svgDataUrl(svg)}
            alt={t('share.previewAlt')}
            className="w-full rounded-xl border border-border"
          />
          {hasRecords ? (
            <CheckboxField
              label={t('share.includeRecord')}
              checked={includeRecords}
              onChange={setIncludeRecords}
            />
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
