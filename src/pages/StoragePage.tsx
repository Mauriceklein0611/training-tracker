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
  const { status, requestPersistence } = useStorageStatus();
  const { settings } = useSettings();
  const toast = useToast();

  return (
    <>
      <PageHeader title="Lokale Speicherung" backTo="/mehr" />

      <div className="grid gap-4">
        <Card>
          <CardHeader
            title="Persistenter Speicher"
            subtitle="Verhindert, dass der Browser deine Trainingsdaten bei Speicherknappheit automatisch löscht."
            as="h2"
          />
          {!status ? (
            <p className="text-sm text-muted" role="status">
              Status wird ermittelt …
            </p>
          ) : !status.supported ? (
            <p className="text-sm leading-relaxed text-muted">
              Dieser Browser stellt die Storage-API nicht bereit. Die App funktioniert
              normal weiter, der Browser kann die Daten aber theoretisch bei
              Speichermangel entfernen. Erstelle deshalb regelmäßig eine Sicherung.
            </p>
          ) : (
            <div className="grid gap-3">
              <p className="flex items-center gap-2 text-sm">
                Status:{' '}
                {status.persisted === true ? (
                  <Badge tone="success">Dauerhaft gewährt</Badge>
                ) : status.persisted === false ? (
                  <Badge tone="warning">Nicht gewährt</Badge>
                ) : (
                  <Badge>Unbekannt</Badge>
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
                          ? 'Persistenter Speicher wurde gewährt.'
                          : 'Der Browser hat persistenten Speicher nicht gewährt. Deine Daten bleiben trotzdem lokal gespeichert.',
                        granted ? 'success' : 'info',
                      );
                    }}
                  >
                    Persistenten Speicher anfordern
                  </Button>
                  <p className="text-xs leading-relaxed text-muted">
                    Viele Browser gewähren das erst, wenn die App zum Home-Bildschirm
                    hinzugefügt oder regelmäßig genutzt wurde. Eine Ablehnung ist kein
                    Fehler.
                  </p>
                </>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Stat label="Belegt" value={formatBytes(status.usageBytes)} />
                <Stat label="Verfügbar" value={formatBytes(status.quotaBytes)} />
              </div>
              <p className="text-xs leading-relaxed text-muted">
                Die Werte sind Schätzungen des Browsers und umfassen auch
                zwischengespeicherte App-Dateien, nicht nur deine Trainingsdaten.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Sicherung" as="h2" />
          <p className="text-sm">
            Letzte vollständige Sicherung:{' '}
            <span className="font-medium">
              {settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'noch nie'}
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Erinnerung alle {settings.backupReminderDays || '—'} Tage.
          </p>
        </Card>

        <Card>
          <CardHeader title="Datenbank" as="h2" />
          <div className="grid gap-2 text-sm">
            <p>
              Schemaversion: <span className="numeric font-medium">{SCHEMA_VERSION}</span>
            </p>
            <p>
              Speicherort:{' '}
              <span className="font-medium">IndexedDB („training-tracker“)</span>
            </p>
            <p>
              Offline-Betrieb:{' '}
              <span className="font-medium">
                {isServiceWorkerSupported() ? 'unterstützt' : 'nicht unterstützt'}
              </span>
            </p>
            <p>
              Startmodus:{' '}
              <span className="font-medium">
                {isStandalone() ? 'installierte App' : 'im Browser'}
              </span>
            </p>
          </div>

          <h3 className="mt-4 text-sm font-semibold">Schema-Historie</h3>
          <ul className="mt-2 grid gap-2">
            {MIGRATIONS.map((migration) => (
              <li key={migration.version} className="text-xs leading-relaxed text-muted">
                <span className="font-medium text-text">
                  Version {migration.version}:
                </span>{' '}
                {migration.description}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Wichtig zu wissen" as="h2" />
          <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-muted">
            <li>Jeder Browser und jedes Gerät besitzt einen eigenen Datenbestand.</li>
            <li>Es gibt keine automatische Synchronisation zwischen Geräten.</li>
            <li>Ein App-Update löscht deine Trainingsdaten nicht.</li>
            <li>
              Das Löschen der Browser-Websitedaten löscht auch deine Trainingshistorie.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
