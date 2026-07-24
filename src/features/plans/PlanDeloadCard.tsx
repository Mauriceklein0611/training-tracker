import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BatteryLow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  endDeloadEarly,
  getActiveDeload,
  startDeload,
} from '@/db/repositories/planDeload';
import { DELOAD_INTENSITY_LABELS, deloadRemainingDays } from '@/services/deload';
import { useToast } from '@/hooks/useToast';
import type { DeloadIntensity } from '@/types';

/** Start / show / end a plan's time-boxed 7-day deload (Phase 5). */
export function PlanDeloadCard({ planId }: { planId: string }) {
  const toast = useToast();
  const active = useLiveQuery(() => getActiveDeload(planId), [planId], undefined);
  const [intensity, setIntensity] = useState<DeloadIntensity>('medium');

  const remaining = active ? deloadRemainingDays(active, new Date()) : 0;

  const handleStart = async () => {
    try {
      await startDeload(planId, intensity);
      toast.show('Deload gestartet — 7 Tage.', 'success');
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        'error',
      );
    }
  };

  const handleEnd = async () => {
    await endDeloadEarly(planId);
    toast.show('Deload beendet.', 'success');
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <BatteryLow size={18} className="text-accent" aria-hidden="true" />
        <span className="text-sm font-semibold">Deload</span>
      </div>

      {active ? (
        <div className="grid gap-2">
          <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
            Deload aktiv ({DELOAD_INTENSITY_LABELS[active.intensity]}) — noch {remaining}{' '}
            {remaining === 1 ? 'Tag' : 'Tage'}. Sätze −
            {Math.round(active.setReductionPercent * 100)} %, Zieldauer −
            {Math.round(active.durationReductionPercent * 100)} %, RIR +{active.addedRir}.
            Die Planwerte bleiben unverändert.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void handleEnd()}>
            Deload vorzeitig beenden
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-muted">
            Eine Woche reduziertes Volumen. Startet heute und endet nach genau 7 Tagen
            automatisch. Die gespeicherten Planwerte werden nie überschrieben.
          </p>
          <Segmented
            label="Intensität"
            value={intensity}
            onChange={(value) => setIntensity(value as DeloadIntensity)}
            options={[
              { value: 'light', label: 'Leicht' },
              { value: 'medium', label: 'Mittel' },
              { value: 'strong', label: 'Stark' },
            ]}
          />
          <Button variant="primary" size="sm" onClick={() => void handleStart()}>
            Deload starten (7 Tage)
          </Button>
        </div>
      )}
    </div>
  );
}
