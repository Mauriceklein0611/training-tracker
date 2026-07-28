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
import { EFFORT_INPUT_LABELS } from '@/services/effort';
import type { AnalyticsRangeKey, AppSettings, EffortInput, ExplainMode } from '@/types';
import { formatDateTime } from '@/utils/date';

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const showIosHint = isIos() && !isStandalone();

  return (
    <>
      <PageHeader title="Einstellungen" backTo="/mehr" />

      <div className="grid gap-4">
        <Card>
          <CardHeader title="Training" as="h2" />
          <div className="grid gap-4">
            <NumberField
              label="Standardpause (Sekunden)"
              value={String(settings.defaultRestSeconds)}
              hint="Wird verwendet, wenn eine Übung keine eigene Pausenzeit vorgibt."
              onChange={(event) => {
                const value = parseNumberInput(event.target.value);
                if (value == null || Number.isNaN(value)) return;
                void update({
                  defaultRestSeconds: Math.min(3600, Math.max(0, Math.round(value))),
                });
              }}
            />
            <SelectField
              label="Einheit"
              value={settings.unit}
              disabled
              hint="Aktuell werden alle Gewichte in Kilogramm erfasst."
            >
              <option value="kg">Kilogramm (kg)</option>
            </SelectField>
            <SelectField
              label="Anstrengung erfassen"
              value={settings.effortInput ?? 'rir'}
              hint="Welche Anstrengungsangabe der Satz-Editor anbietet. Optional — ein Satz kann immer ohne Angabe abgeschlossen werden."
              onChange={(event) =>
                void update({ effortInput: event.target.value as EffortInput })
              }
            >
              {(Object.keys(EFFORT_INPUT_LABELS) as EffortInput[]).map((key) => (
                <option key={key} value={key}>
                  {EFFORT_INPUT_LABELS[key]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Fachbegriffe"
              value={settings.explainMode ?? 'beginner'}
              hint="Anfänger sehen ausführliche Labels (z. B. „Anstrengung (RPE)“), erfahrene Nutzer kompakte Fachlabels."
              onChange={(event) =>
                void update({ explainMode: event.target.value as ExplainMode })
              }
            >
              <option value="beginner">Ausführlich (Anfänger)</option>
              <option value="expert">Kompakt (erfahren)</option>
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pausensignal" as="h2" />
          <div className="grid gap-4">
            <CheckboxField
              label="Ton bei abgelaufener Pause"
              hint="Wird lokal erzeugt. Auf dem iPhone muss die App dafür zuvor einmal berührt worden sein."
              checked={settings.restSoundEnabled}
              onChange={(checked) => void update({ restSoundEnabled: checked })}
            />
            <CheckboxField
              label="Vibration bei abgelaufener Pause"
              hint="Wird nicht von allen Geräten unterstützt — iOS-Browser ignorieren die Vibration."
              checked={settings.restVibrationEnabled}
              onChange={(checked) => void update({ restVibrationEnabled: checked })}
            />
            <CheckboxField
              label="Sprachansage bei Pausenende"
              hint={
                isSpeechSupported()
                  ? 'Kündigt das Pausenende lokal per Sprachausgabe an. Auf dem iPhone muss die App dafür zuvor einmal berührt worden sein.'
                  : 'Dieser Browser unterstützt die Sprachausgabe nicht — die Einstellung bleibt dann wirkungslos.'
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
                if (settings.voiceAnnouncementsEnabled) speak('Pause beendet.');
              }}
            >
              Signal testen
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Bildschirm" as="h2" />
          <CheckboxField
            label="Bildschirm während des Trainings aktiv halten"
            hint={
              isWakeLockSupported()
                ? 'Verhindert, dass sich das Display zwischen den Sätzen ausschaltet.'
                : 'Dieser Browser unterstützt die Funktion nicht — die Einstellung bleibt dann wirkungslos. Die App funktioniert normal weiter.'
            }
            checked={settings.keepScreenAwake}
            onChange={(checked) => void update({ keepScreenAwake: checked })}
          />
        </Card>

        <Card>
          <CardHeader title="Darstellung" as="h2" />
          <SelectField
            label="Farbmodus"
            value={settings.darkMode}
            hint="Der dunkle Modus ist für das Training in Innenräumen voreingestellt."
            onChange={(event) =>
              void update({ darkMode: event.target.value as AppSettings['darkMode'] })
            }
          >
            <option value="dark">Dunkel (Gym-Modus)</option>
            <option value="light">Hell</option>
            <option value="system">Systemeinstellung folgen</option>
          </SelectField>
        </Card>

        <Card>
          <CardHeader title="Analyse" as="h2" />
          <SelectField
            label="Standardzeitraum"
            value={settings.defaultAnalyticsRange}
            onChange={(event) =>
              void update({
                defaultAnalyticsRange: event.target.value as AnalyticsRangeKey,
              })
            }
          >
            <option value="7d">7 Tage</option>
            <option value="30d">30 Tage</option>
            <option value="90d">90 Tage</option>
            <option value="all">Gesamter Zeitraum</option>
          </SelectField>
        </Card>

        <Card>
          <CardHeader
            title="Wochenziele"
            subtitle="Erscheinen im Verlauf über dem Kalender."
            as="h2"
          />
          <WeeklyGoalsEditor
            goals={settings.weeklyGoals}
            onChange={(weeklyGoals) => void update({ weeklyGoals })}
          />
        </Card>

        <Card>
          <CardHeader title="Sicherungserinnerung" as="h2" />
          <div className="grid gap-4">
            <NumberField
              label="Erinnerungsintervall (Tage)"
              value={String(settings.backupReminderDays)}
              hint="0 deaktiviert die Erinnerung. Eine Sicherung ist die einzige Möglichkeit, deine Daten auf ein anderes Gerät zu übertragen."
              onChange={(event) => {
                const value = parseNumberInput(event.target.value);
                if (value == null || Number.isNaN(value)) return;
                void update({
                  backupReminderDays: Math.min(365, Math.max(0, Math.round(value))),
                });
              }}
            />
            <p className="text-sm text-muted">
              Letzte Sicherung:{' '}
              <span className="font-medium text-text">
                {settings.lastBackupAt
                  ? formatDateTime(settings.lastBackupAt)
                  : 'noch nie'}
              </span>
            </p>
          </div>
        </Card>

        {showIosHint ? (
          <Card>
            <CardHeader title="Auf dem iPhone installieren" as="h2" />
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed text-muted">
              <li>Diese Seite in Safari öffnen.</li>
              <li>Unten auf „Teilen“ tippen.</li>
              <li>„Zum Home-Bildschirm“ auswählen.</li>
              <li>Die App künftig über das Symbol auf dem Home-Bildschirm starten.</li>
            </ol>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Als installierte App läuft der Tracker im Vollbild und funktioniert
              vollständig ohne Internetverbindung.
            </p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
