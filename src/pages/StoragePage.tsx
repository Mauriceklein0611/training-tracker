import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, CardHeader, Stat } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useStorageStatus } from '@/hooks/useStorageStatus';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { formatBytes } from '@/services/storage';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/db';
import { formatDateTime } from '@/utils/date';
import { isServiceWorkerSupported, isStandalone } from '@/services/pwa';

export default function StoragePage() {
  const { t } = useTranslation('storage');
  const { status, requestPersistence } = useStorageStatus();
  const { settings } = useSettings();
  const toast = useToast();

  return (
    <>
      <PageHeader title={t('title')} backTo="/mehr" />

      <div className="grid gap-4">
        <Card>
          <CardHeader
            title={t('persistent.sectionTitle')}
            subtitle={t('persistent.subtitle')}
            as="h2"
          />
          {!status ? (
            <p className="text-sm text-muted" role="status">
              {t('persistent.checking')}
            </p>
          ) : !status.supported ? (
            <p className="text-sm leading-relaxed text-muted">
              {t('persistent.unsupported')}
            </p>
          ) : (
            <div className="grid gap-3">
              <p className="flex items-center gap-2 text-sm">
                {t('persistent.statusLabel')}{' '}
                {status.persisted === true ? (
                  <Badge tone="success">{t('persistent.granted')}</Badge>
                ) : status.persisted === false ? (
                  <Badge tone="warning">{t('persistent.notGranted')}</Badge>
                ) : (
                  <Badge>{t('persistent.unknown')}</Badge>
                )}
              </p>

              {status.persisted !== true ? (
                <>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      const granted = await requestPersistence();
                      toast.show(
                        granted
                          ? t('persistent.grantedToast')
                          : t('persistent.deniedToast'),
                        granted ? 'success' : 'info',
                      );
                    }}
                  >
                    {t('persistent.request')}
                  </Button>
                  <p className="text-xs leading-relaxed text-muted">
                    {t('persistent.requestHint')}
                  </p>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t('persistent.used')}
                  value={formatBytes(status.usageBytes)}
                />
                <Stat
                  label={t('persistent.available')}
                  value={formatBytes(status.quotaBytes)}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {t('persistent.estimateHint')}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('backup.sectionTitle')} as="h2" />
          <p className="text-sm">
            {t('backup.last')}{' '}
            <span className="font-medium">
              {settings.lastBackupAt
                ? formatDateTime(settings.lastBackupAt)
                : t('backup.never')}
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t('backup.reminder', { days: settings.backupReminderDays || '—' })}
          </p>
        </Card>

        <Card>
          <CardHeader title={t('database.sectionTitle')} as="h2" />
          <div className="grid gap-2 text-sm">
            <p>
              {t('database.schemaVersion')}{' '}
              <span className="numeric font-medium">{SCHEMA_VERSION}</span>
            </p>
            <p>
              {t('database.location')}{' '}
              <span className="font-medium">IndexedDB („training-tracker“)</span>
            </p>
            <p>
              {t('database.offline')}{' '}
              <span className="font-medium">
                {isServiceWorkerSupported()
                  ? t('database.offlineSupported')
                  : t('database.offlineUnsupported')}
              </span>
            </p>
            <p>
              {t('database.startMode')}{' '}
              <span className="font-medium">
                {isStandalone()
                  ? t('database.startModeInstalled')
                  : t('database.startModeBrowser')}
              </span>
            </p>
          </div>

          <h3 className="mt-4 text-sm font-semibold">{t('database.history')}</h3>
          <ul className="mt-2 grid gap-2">
            {MIGRATIONS.map((migration) => (
              <li key={migration.version} className="text-xs leading-relaxed text-muted">
                <span className="font-medium text-text">
                  {t('database.version', { version: migration.version })}
                </span>{' '}
                {migration.description}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t('goodToKnow.sectionTitle')} as="h2" />
          <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-muted">
            <li>{t('goodToKnow.ownData')}</li>
            <li>{t('goodToKnow.noSync')}</li>
            <li>{t('goodToKnow.updateSafe')}</li>
            <li>{t('goodToKnow.clearingDeletes')}</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
