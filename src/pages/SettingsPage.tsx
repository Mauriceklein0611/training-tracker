import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { CheckboxField, NumberField, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { WeeklyGoalsEditor } from '@/features/settings/WeeklyGoalsEditor';
import { useSettings } from '@/hooks/useSettings';
import { parseNumberInput } from '@/services/validation';
import { isIos, isStandalone } from '@/services/pwa';
import { isWakeLockSupported } from '@/hooks/useWakeLock';
import { playRestFinishedSound, primeAudio, vibrate } from '@/services/sound';
import { isSpeechSupported, speak } from '@/services/speech';
import type { AnalyticsRangeKey, AppSettings, EffortInput, ExplainMode } from '@/types';
import { formatDateTime } from '@/utils/date';
import {
  APP_VERSION,
  IMPRINT_URL,
  LEGACY_APP_URL,
  SITE_URL,
  isLegacyMigrationAvailable,
} from '@/config/brand';
import { resetOnboarding } from '@/services/onboarding';

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const { t: tSettings } = useTranslation('settings');
  const showIosHint = isIos() && !isStandalone();
  const showLegacyMigration = isLegacyMigrationAvailable();

  return (
    <>
      <PageHeader title={tSettings('title')} backTo="/mehr" />

      <div className="grid gap-4">
        <Card>
          <CardHeader title={tSettings('training.sectionTitle')} as="h2" />
          <div className="grid gap-4">
            <NumberField
              label={tSettings('training.restLabel')}
              value={String(settings.defaultRestSeconds)}
              hint={tSettings('training.restHint')}
              onChange={(event) => {
                const value = parseNumberInput(event.target.value);
                if (value == null || Number.isNaN(value)) return;
                void update({
                  defaultRestSeconds: Math.min(3600, Math.max(0, Math.round(value))),
                });
              }}
            />
            <SelectField
              label={tSettings('training.unitLabel')}
              value={settings.unit}
              disabled
              hint={tSettings('training.unitHint')}
            >
              <option value="kg">{tSettings('training.unitKg')}</option>
            </SelectField>
            <SelectField
              label={tSettings('training.effortLabel')}
              value={settings.effortInput ?? 'rir'}
              hint={tSettings('training.effortHint')}
              onChange={(event) =>
                void update({ effortInput: event.target.value as EffortInput })
              }
            >
              <option value="rpe">{tSettings('training.effortRpe')}</option>
              <option value="rir">{tSettings('training.effortRir')}</option>
              <option value="none">{tSettings('training.effortNone')}</option>
            </SelectField>
            <SelectField
              label={tSettings('training.termsLabel')}
              value={settings.explainMode ?? 'beginner'}
              hint={tSettings('training.termsHint')}
              onChange={(event) =>
                void update({ explainMode: event.target.value as ExplainMode })
              }
            >
              <option value="beginner">{tSettings('training.termsBeginner')}</option>
              <option value="expert">{tSettings('training.termsExpert')}</option>
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardHeader title={tSettings('rest.sectionTitle')} as="h2" />
          <div className="grid gap-4">
            <CheckboxField
              label={tSettings('rest.soundLabel')}
              hint={tSettings('rest.soundHint')}
              checked={settings.restSoundEnabled}
              onChange={(checked) => void update({ restSoundEnabled: checked })}
            />
            <CheckboxField
              label={tSettings('rest.vibrationLabel')}
              hint={tSettings('rest.vibrationHint')}
              checked={settings.restVibrationEnabled}
              onChange={(checked) => void update({ restVibrationEnabled: checked })}
            />
            <CheckboxField
              label={tSettings('rest.voiceLabel')}
              hint={
                isSpeechSupported()
                  ? tSettings('rest.voiceHint')
                  : tSettings('rest.voiceUnsupported')
              }
              checked={settings.voiceAnnouncementsEnabled}
              onChange={(checked) => void update({ voiceAnnouncementsEnabled: checked })}
            />
            <Button
              variant="secondary"
              onClick={() => {
                primeAudio();
                if (settings.restSoundEnabled) playRestFinishedSound();
                if (settings.restVibrationEnabled) vibrate();
                if (settings.voiceAnnouncementsEnabled)
                  speak(tSettings('rest.voiceTest'));
              }}
            >
              {tSettings('rest.testSignal')}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title={tSettings('screen.sectionTitle')} as="h2" />
          <CheckboxField
            label={tSettings('screen.keepAwakeLabel')}
            hint={
              isWakeLockSupported()
                ? tSettings('screen.keepAwakeHint')
                : tSettings('screen.keepAwakeUnsupported')
            }
            checked={settings.keepScreenAwake}
            onChange={(checked) => void update({ keepScreenAwake: checked })}
          />
        </Card>

        <Card>
          <CardHeader title={tSettings('language.sectionTitle')} as="h2" />
          <SelectField
            label={tSettings('language.label')}
            value={settings.language}
            hint={tSettings('language.hint')}
            onChange={(event) =>
              void update({
                language: event.target.value as AppSettings['language'],
              })
            }
          >
            <option value="auto">{tSettings('language.auto')}</option>
            <option value="de">{tSettings('language.de')}</option>
            <option value="en">{tSettings('language.en')}</option>
          </SelectField>
        </Card>

        <Card>
          <CardHeader title={tSettings('appearance.sectionTitle')} as="h2" />
          <SelectField
            label={tSettings('appearance.colorModeLabel')}
            value={settings.darkMode}
            hint={tSettings('appearance.colorModeHint')}
            onChange={(event) =>
              void update({ darkMode: event.target.value as AppSettings['darkMode'] })
            }
          >
            <option value="dark">{tSettings('appearance.dark')}</option>
            <option value="light">{tSettings('appearance.light')}</option>
            <option value="system">{tSettings('appearance.system')}</option>
          </SelectField>
        </Card>

        <Card>
          <CardHeader title={tSettings('analytics.sectionTitle')} as="h2" />
          <SelectField
            label={tSettings('analytics.rangeLabel')}
            value={settings.defaultAnalyticsRange}
            onChange={(event) =>
              void update({
                defaultAnalyticsRange: event.target.value as AnalyticsRangeKey,
              })
            }
          >
            <option value="7d">{tSettings('analytics.range7d')}</option>
            <option value="30d">{tSettings('analytics.range30d')}</option>
            <option value="90d">{tSettings('analytics.range90d')}</option>
            <option value="all">{tSettings('analytics.rangeAll')}</option>
          </SelectField>
        </Card>

        <Card>
          <CardHeader
            title={tSettings('weeklyGoals.sectionTitle')}
            subtitle={tSettings('weeklyGoals.subtitle')}
            as="h2"
          />
          <WeeklyGoalsEditor
            goals={settings.weeklyGoals}
            onChange={(weeklyGoals) => void update({ weeklyGoals })}
          />
        </Card>

        <Card>
          <CardHeader title={tSettings('backupReminder.sectionTitle')} as="h2" />
          <div className="grid gap-4">
            <NumberField
              label={tSettings('backupReminder.intervalLabel')}
              value={String(settings.backupReminderDays)}
              hint={tSettings('backupReminder.intervalHint')}
              onChange={(event) => {
                const value = parseNumberInput(event.target.value);
                if (value == null || Number.isNaN(value)) return;
                void update({
                  backupReminderDays: Math.min(365, Math.max(0, Math.round(value))),
                });
              }}
            />
            <p className="text-sm text-muted">
              {tSettings('backupReminder.lastBackup')}{' '}
              <span className="font-medium text-text">
                {settings.lastBackupAt
                  ? formatDateTime(settings.lastBackupAt)
                  : tSettings('backupReminder.never')}
              </span>
            </p>
          </div>
        </Card>

        {showLegacyMigration ? (
          <Card>
            <CardHeader
              title={tSettings('legacyMigration.sectionTitle')}
              subtitle={tSettings('legacyMigration.description')}
              as="h2"
            />
            <a
              href={LEGACY_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-center font-medium"
            >
              {tSettings('legacyMigration.openLegacy')}
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          </Card>
        ) : null}

        {showIosHint ? (
          <Card>
            <CardHeader title={tSettings('ios.sectionTitle')} as="h2" />
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed text-muted">
              <li>{tSettings('ios.step1')}</li>
              <li>{tSettings('ios.step2')}</li>
              <li>{tSettings('ios.step3')}</li>
              <li>{tSettings('ios.step4')}</li>
            </ol>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {tSettings('ios.note')}
            </p>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title={tSettings('about.sectionTitle')}
            subtitle={tSettings('about.version', { version: APP_VERSION })}
            as="h2"
          />
          <div className="grid gap-2">
            <Link
              to="/hilfe"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-surface-2 px-4 font-medium"
            >
              {tSettings('about.guide')}
            </Link>
            <Link
              to="/hilfe/was-ist-neu"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-surface-2 px-4 font-medium"
            >
              {tSettings('about.whatsNew')}
            </Link>
            <a
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 font-medium"
            >
              {tSettings('about.website')}
              <ExternalLink size={17} aria-hidden="true" />
            </a>
            <a
              href={IMPRINT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 font-medium"
            >
              {tSettings('about.imprint')}
              <ExternalLink size={17} aria-hidden="true" />
            </a>
            <Button
              variant="ghost"
              onClick={() => {
                resetOnboarding();
                window.location.assign('/');
              }}
            >
              {tSettings('about.repeatOnboarding')}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
