import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { appOrigin } from '@/config/brand';
import { onboarding as deOnboarding } from '@/i18n/locales/de/onboarding';
import { onboarding as enOnboarding } from '@/i18n/locales/en/onboarding';
import { getLanguage } from '@/i18n';
import {
  completeOnboarding,
  hasMeaningfulUserData,
  ONBOARDING_VERSION,
  readOnboardingState,
} from '@/services/onboarding';

export function OnboardingDialog() {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const resource = getLanguage() === 'de' ? deOnboarding : enOnboarding;
  const existingData = useLiveQuery(() => hasMeaningfulUserData(), [], undefined);
  const [stepIndex, setStepIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const state = readOnboardingState();
  const shouldOpen =
    !closed &&
    appOrigin() !== 'legacy' &&
    existingData === false &&
    !(state?.completed && state.version >= ONBOARDING_VERSION);

  const step = resource.steps[stepIndex];
  const isLast = stepIndex === resource.steps.length - 1;

  const finish = (target?: string) => {
    completeOnboarding();
    setClosed(true);
    if (target) navigate(target);
  };

  const specialAction =
    step?.id === 'import'
      ? { label: resource.openImport, target: '/mehr/daten' }
      : step?.id === 'plan'
        ? { label: resource.openPlans, target: '/plaene' }
        : step?.id === 'guide'
          ? { label: resource.openGuide, target: '/hilfe' }
          : null;

  return (
    <Dialog
      open={shouldOpen}
      onClose={() => finish()}
      title={resource.dialogTitle}
      description={t('progress', {
        current: stepIndex + 1,
        total: resource.steps.length,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={() => finish()}>
            {resource.skip}
          </Button>
          {stepIndex > 0 ? (
            <Button
              variant="secondary"
              onClick={() => setStepIndex((value) => value - 1)}
            >
              {resource.previous}
            </Button>
          ) : null}
          {specialAction ? (
            <Button variant="secondary" onClick={() => finish(specialAction.target)}>
              {specialAction.label}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() =>
              isLast
                ? finish()
                : setStepIndex((value) => Math.min(value + 1, resource.steps.length - 1))
            }
          >
            {isLast ? resource.finish : resource.next}
          </Button>
        </>
      }
    >
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${((stepIndex + 1) / resource.steps.length) * 100}%` }}
        />
      </div>
      <h3 className="text-xl font-semibold">{step?.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{step?.text}</p>
    </Dialog>
  );
}
