import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { LEGACY_APP_URL, appOrigin, isLegacyMigrationAvailable } from '@/config/brand';
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
  const migrationAvailable = isLegacyMigrationAvailable();
  const steps = migrationAvailable
    ? resource.steps
    : resource.steps.filter((candidate) => candidate.id !== 'import');
  const shouldOpen =
    !closed &&
    appOrigin() !== 'legacy' &&
    existingData === false &&
    !(state?.completed && state.version >= ONBOARDING_VERSION);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isMigrationStep = step?.id === 'import';

  const finish = (target?: string) => {
    completeOnboarding();
    setClosed(true);
    if (target) navigate(target);
  };

  const specialAction =
    step?.id === 'plan'
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
        total: steps.length,
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
                : setStepIndex((value) => Math.min(value + 1, steps.length - 1))
            }
          >
            {isMigrationStep
              ? resource.continueWithoutLegacy
              : isLast
                ? resource.finish
                : resource.next}
          </Button>
        </>
      }
    >
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      <h3 className="text-xl font-semibold">{step?.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{step?.text}</p>
      {isMigrationStep ? (
        <div className="mt-4 grid gap-2">
          <a
            href={LEGACY_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-4 text-center font-semibold text-accent-contrast"
          >
            {resource.openLegacy}
            <ExternalLink size={17} aria-hidden="true" />
          </a>
          <Button fullWidth variant="secondary" onClick={() => finish('/mehr/daten')}>
            {resource.openImport}
          </Button>
          <p className="text-xs leading-relaxed text-muted">
            {resource.migrationDeadline}
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}
