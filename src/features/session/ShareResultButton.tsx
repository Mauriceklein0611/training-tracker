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

/** Builds the card input from a summary, honouring the include toggles. */
function toInput(summary: SessionSummary, includeRecords: boolean): ShareCardInput {
  const stats: { label: string; value: string }[] = [];
  if (summary.durationSeconds != null) {
    stats.push({ label: 'Dauer', value: formatDurationLong(summary.durationSeconds) });
  }
  if (summary.hasStrength) {
    stats.push({ label: 'Arbeitssätze', value: formatNumber(summary.workingSetCount) });
    stats.push({ label: 'Volumen', value: formatVolume(summary.volume.volumeKg) });
  }
  if (summary.hasCardio) {
    stats.push({
      label: 'Cardio-Zeit',
      value: formatDuration(summary.cardio.totalDurationSeconds),
    });
    if (summary.cardio.totalDistanceMeters > 0) {
      stats.push({
        label: 'Distanz',
        value: formatCardioDistance(
          summary.cardio.totalDistanceMeters,
          summary.cardioModality,
        ),
      });
    }
    if (summary.cardioPace) {
      stats.push({ label: 'Ø Pace', value: formatPace(summary.cardioPace) });
    }
    if (summary.cardioAvgRpe != null) {
      stats.push({ label: 'Ø RPE', value: formatNumber(summary.cardioAvgRpe, 1) });
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
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [includeRecords, setIncludeRecords] = useState(true);
  const [busy, setBusy] = useState(false);

  const hasRecords = summary.newRecords.length > 0;
  const svg = useMemo(
    () => buildShareCardSvg(toInput(summary, includeRecords && hasRecords)),
    [summary, includeRecords, hasRecords],
  );

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(svg);
      const outcome = await shareImage(blob, 'training-ergebnis.png');
      if (outcome === 'downloaded') toast.show('Grafik gespeichert.', 'success');
      else if (outcome === 'failed')
        toast.show('Teilen nicht möglich. Bitte erneut versuchen.', 'error');
    } catch {
      toast.show('Grafik konnte nicht erzeugt werden.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setOpen(true)}>
        <Share2 size={18} aria-hidden="true" />
        Ergebnis teilen
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ergebnis teilen"
        description="Die Grafik entsteht lokal auf deinem Gerät. Es werden keine Körperdaten aufgenommen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Schließen
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void handleShare()}>
              <Share2 size={18} aria-hidden="true" />
              {busy ? 'Wird erzeugt …' : 'Teilen'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <img
            src={svgDataUrl(svg)}
            alt="Vorschau der Ergebnisgrafik"
            className="w-full rounded-xl border border-border"
          />
          {hasRecords ? (
            <CheckboxField
              label="Persönliche Bestleistung anzeigen"
              checked={includeRecords}
              onChange={setIncludeRecords}
            />
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
