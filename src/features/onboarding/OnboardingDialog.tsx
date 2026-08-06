import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/Field';
import { upsertBodyWeightEntry } from '@/db/repositories/bodyWeight';
import { updateSettings } from '@/db/repositories/settings';
import { parseNumberInput } from '@/services/validation';
import { todayKey } from '@/utils/date';
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
  const isProfileStep = step?.id === 'profile';

  /*
   * Optional body data (#44). Height is a settings value, weight is a normal
   * dated body entry — the same record the body-data screen writes, so nothing
   * is duplicated and the weight keeps its history. Whatever is entered is
   * saved when the step is left, including via "skip": the user typed it on
   * purpose. Anything out of range is rejected with a message instead of being
   * silently rounded into something the user did not mean.
   */
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [profileError, setProfileError] = useState<{
    height?: string;
    weight?: string;
  }>({});

  const saveProfile = async (): Promise<boolean> => {
    const height = parseNumberInput(heightInput);
    const weight = parseNumberInput(weightInput);
    const errors: { height?: string; weight?: string } = {};
    if (height != null && !(height >= 50 && height <= 280)) {
      errors.height = resource.profile.invalidHeight;
    }
    if (weight != null && !(weight >= 20 && weight <= 500)) {
      errors.weight = resource.profile.invalidWeight;
    }
    setProfileError(errors);
    if (errors.height || errors.weight) return false;

    if (height != null) await updateSettings({ heightCm: Math.round(height) });
    if (weight != null) {
      await upsertBodyWeightEntry({ date: todayKey(), weightKg: weight });
    }
    return true;
  };

  /** Leaves the current step, persisting the body data first when it is shown. */
  const leaveStep = async (move: () => void) => {
    if (isProfileStep && !(await saveProfile())) return;
    move();
  };

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

  /** Closing or skipping never blocks: valid body data is kept, the rest dropped. */
  const skip = () => {
    if (isProfileStep) void saveProfile().finally(() => finish());
    else finish();
  };

  return (
    <Dialog
      open={shouldOpen}
      onClose={skip}
      title={resource.dialogTitle}
      description={t('progress', {
        current: stepIndex + 1,
        total: steps.length,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={skip}>
            {resource.skip}
          </Button>
          {stepIndex > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void leaveStep(() => setStepIndex((value) => value - 1))}
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
              void leaveStep(() =>
                isLast
                  ? finish()
                  : setStepIndex((value) => Math.min(value + 1, steps.length - 1)),
              )
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
      {isProfileStep ? (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={resource.profile.heightLabel}
              value={heightInput}
              error={profileError.height}
              onChange={(event) => setHeightInput(event.target.value)}
            />
            <NumberField
              label={resource.profile.weightLabel}
              decimal
              value={weightInput}
              error={profileError.weight}
              onChange={(event) => setWeightInput(event.target.value)}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted">{resource.profile.hint}</p>
        </div>
      ) : null}

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
