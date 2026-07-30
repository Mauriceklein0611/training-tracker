import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { BatteryLow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  endDeloadEarly,
  getActiveDeload,
  startDeload,
} from '@/db/repositories/planDeload';
import { deloadRemainingDays } from '@/services/deload';
import { useToast } from '@/hooks/useToast';
import type { DeloadIntensity } from '@/types';

/** Start / show / end a plan's time-boxed 7-day deload (Phase 5). */
export function PlanDeloadCard({ planId }: { planId: string }) {
  const { t } = useTranslation('plans');
  const toast = useToast();
  const active = useLiveQuery(() => getActiveDeload(planId), [planId], undefined);
  const [intensity, setIntensity] = useState<DeloadIntensity>('medium');

  const remaining = active ? deloadRemainingDays(active, new Date()) : 0;

  const handleStart = async () => {
    try {
      await startDeload(planId, intensity);
      toast.show(t('deload.started'), 'success');
    } catch {
      toast.show(t('deload.startFailed'), 'error');
    }
  };

  const handleEnd = async () => {
    await endDeloadEarly(planId);
    toast.show(t('deload.ended'), 'success');
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <BatteryLow size={18} className="text-accent" aria-hidden="true" />
        <span className="text-sm font-semibold">{t('deload.title')}</span>
      </div>

      {active ? (
        <div className="grid gap-2">
          <p className="rounded-xl border border-warning/50 bg-surface-2 p-2 text-xs text-warning">
            {t('deload.active', {
              intensity: t(`deload.${active.intensity}`),
              count: remaining,
              days: t(remaining === 1 ? 'deload.dayOne' : 'deload.dayOther'),
              sets: Math.round(active.setReductionPercent * 100),
              duration: Math.round(active.durationReductionPercent * 100),
              rir: active.addedRir,
            })}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void handleEnd()}>
            {t('deload.end')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-muted">{t('deload.description')}</p>
          <Segmented
            label={t('deload.intensity')}
            value={intensity}
            onChange={(value) => setIntensity(value as DeloadIntensity)}
            options={[
              { value: 'light', label: t('deload.light') },
              { value: 'medium', label: t('deload.medium') },
              { value: 'strong', label: t('deload.strong') },
            ]}
          />
          <Button variant="primary" size="sm" onClick={() => void handleStart()}>
            {t('deload.start')}
          </Button>
        </div>
      )}
    </div>
  );
}
