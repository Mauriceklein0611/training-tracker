import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  ArchiveRestore,
  GitCompareArrows,
  RotateCcw,
  Save,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Segmented, TextField } from '@/components/ui/Field';
import { db } from '@/db/db';
import {
  activateDeload,
  activateTemplateVersion,
  createTemplateVersion,
  deleteTemplateVersion,
  listTemplateVersions,
  setTemplateVersionArchived,
  snapshotTemplate,
} from '@/db/repositories/templateVersions';
import { TemplateDiffView } from '@/features/templates/TemplateDiffView';
import { diffTemplateSnapshots, type TemplateDiff } from '@/services/templateDiff';
import {
  applyDeloadToSnapshot,
  DELOAD_INTENSITY_LABELS,
  DELOAD_PERCENT,
  type DeloadIntensity,
} from '@/services/deload';
import { useToast } from '@/hooks/useToast';
import type { TemplateVersion, TemplateVersionSource } from '@/types';
import { formatDateTime } from '@/utils/date';

const SOURCE_LABEL: Record<TemplateVersionSource, string> = {
  manual: 'manuell',
  'ai-import': 'KI-Import',
  auto: 'automatisch',
};

export default function TemplateVersionsPage() {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const template = useLiveQuery(() => db.workoutTemplates.get(templateId), [templateId]);
  const versions = useLiveQuery(() => listTemplateVersions(templateId), [templateId], []);

  const [label, setLabel] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [compare, setCompare] = useState<{
    version: TemplateVersion;
    diff: TemplateDiff;
  } | null>(null);
  const [restore, setRestore] = useState<TemplateVersion | null>(null);
  const [remove, setRemove] = useState<TemplateVersion | null>(null);
  const [deloadIntensity, setDeloadIntensity] = useState<DeloadIntensity>('medium');
  const [deloadPreview, setDeloadPreview] = useState<TemplateDiff | null>(null);

  const visible = versions.filter((version) => showArchived || !version.archived);
  const archivedCount = versions.filter((version) => version.archived).length;

  const handleSave = async () => {
    await createTemplateVersion(templateId, { label: label.trim() || undefined });
    setLabel('');
    toast.show('Version gespeichert.', 'success');
  };

  const openCompare = async (version: TemplateVersion) => {
    const current = await snapshotTemplate(templateId);
    // Diff from the saved version to the current live plan.
    setCompare({ version, diff: diffTemplateSnapshots(version.snapshot, current) });
  };

  const handleRestore = async () => {
    if (!restore) return;
    await activateTemplateVersion(restore.id);
    setRestore(null);
    toast.show(
      'Version wiederhergestellt. Der vorherige Stand wurde gesichert.',
      'success',
    );
    navigate(`/plaene/${templateId}`);
  };

  const openDeloadPreview = async () => {
    const current = await snapshotTemplate(templateId);
    const reduced = applyDeloadToSnapshot(current, DELOAD_PERCENT[deloadIntensity]);
    setDeloadPreview(diffTemplateSnapshots(current, reduced));
  };

  const handleDeload = async () => {
    await activateDeload(templateId, deloadIntensity);
    setDeloadPreview(null);
    toast.show(
      'Deload aktiviert. Der normale Plan wurde als Version gesichert.',
      'success',
    );
    navigate(`/plaene/${templateId}`);
  };

  if (template === undefined) {
    return (
      <>
        <PageHeader title="Versionen" backTo={`/plaene/${templateId}`} />
        <p className="text-sm text-muted" role="status">
          Wird geladen …
        </p>
      </>
    );
  }

  if (!template) {
    return (
      <>
        <PageHeader title="Versionen" backTo="/plaene" />
        <EmptyState
          title="Plan nicht gefunden"
          description="Dieser Trainingsplan existiert nicht mehr."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Planversionen"
        subtitle={template.name}
        backTo={`/plaene/${templateId}`}
      />

      <Card className="mb-4">
        <CardHeader
          title="Aktuellen Stand sichern"
          subtitle="Friert den Plan als unveränderliche Version ein. Der Plan selbst bleibt bearbeitbar."
          as="h2"
        />
        <div className="grid gap-2">
          <TextField
            label="Bezeichnung (optional)"
            value={label}
            placeholder="z. B. Vor der Diätphase"
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button variant="primary" onClick={() => void handleSave()}>
            <Save size={18} aria-hidden="true" />
            Version speichern
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Deload-Woche"
          subtitle="Reduziert vorübergehend die Ziel-Sätze aller Übungen. Der normale Plan wird vorher gesichert."
          as="h2"
        />
        <div className="grid gap-2">
          <Segmented
            label="Intensität"
            value={deloadIntensity}
            onChange={setDeloadIntensity}
            options={[
              { value: 'light', label: DELOAD_INTENSITY_LABELS.light },
              { value: 'medium', label: DELOAD_INTENSITY_LABELS.medium },
              { value: 'strong', label: DELOAD_INTENSITY_LABELS.strong },
            ]}
          />
          <Button variant="secondary" onClick={() => void openDeloadPreview()}>
            <TrendingDown size={18} aria-hidden="true" />
            Vorschau
          </Button>
        </div>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title="Noch keine Versionen"
          description="Speichere den aktuellen Stand, bevor du größere Änderungen machst — so kannst du jederzeit zu einer früheren Fassung zurückkehren."
        />
      ) : (
        <ul className="grid gap-2">
          {visible.map((version) => (
            <li
              key={version.id}
              className={`rounded-2xl border border-border bg-surface p-3 ${
                version.archived ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="text-muted">v{version.versionNumber}</span>
                    <span className="min-w-0 truncate">{version.label}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge>{SOURCE_LABEL[version.source]}</Badge>
                    <span>{formatDateTime(version.createdAt)}</span>
                    <span>{version.snapshot.exercises.length} Übungen</span>
                  </p>
                  {version.note ? (
                    <p className="mt-1 text-sm text-muted">{version.note}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void openCompare(version)}
                >
                  <GitCompareArrows size={16} aria-hidden="true" />
                  Vergleichen
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRestore(version)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Wiederherstellen
                </Button>
                <IconButton
                  label={
                    version.archived ? 'Version reaktivieren' : 'Version archivieren'
                  }
                  onClick={() =>
                    void setTemplateVersionArchived(version.id, !version.archived)
                  }
                >
                  {version.archived ? (
                    <ArchiveRestore size={18} aria-hidden="true" />
                  ) : (
                    <Archive size={18} aria-hidden="true" />
                  )}
                </IconButton>
                <IconButton label="Version löschen" onClick={() => setRemove(version)}>
                  <Trash2 size={18} aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {archivedCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          className="mt-3 min-h-[44px] text-sm font-medium text-accent"
        >
          {showArchived
            ? 'Archivierte ausblenden'
            : `Archivierte anzeigen (${archivedCount})`}
        </button>
      ) : null}

      <Dialog
        open={compare != null}
        onClose={() => setCompare(null)}
        title={
          compare
            ? `Vergleich: v${compare.version.versionNumber} → aktueller Plan`
            : 'Vergleich'
        }
        description="Was sich von dieser gespeicherten Version zum aktuellen Plan geändert hat."
      >
        {compare ? <TemplateDiffView diff={compare.diff} /> : null}
      </Dialog>

      <Dialog
        open={deloadPreview != null}
        onClose={() => setDeloadPreview(null)}
        title={`Deload-Vorschau (${DELOAD_INTENSITY_LABELS[deloadIntensity]})`}
        description="So ändern sich die Ziel-Sätze. Beim Aktivieren wird der aktuelle Plan zuerst als Version gesichert."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeloadPreview(null)}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={() => void handleDeload()}>
              Deload aktivieren
            </Button>
          </>
        }
      >
        {deloadPreview ? <TemplateDiffView diff={deloadPreview} /> : null}
      </Dialog>

      <ConfirmDialog
        open={restore != null}
        title="Version wiederherstellen?"
        description={
          restore
            ? `Der Plan wird auf „${restore.label}" (v${restore.versionNumber}) zurückgesetzt. Der aktuelle Stand wird vorher automatisch als eigene Version gesichert, sodass nichts verloren geht.`
            : ''
        }
        confirmLabel="Wiederherstellen"
        onCancel={() => setRestore(null)}
        onConfirm={() => void handleRestore()}
      />

      <ConfirmDialog
        open={remove != null}
        title="Version löschen?"
        description="Diese gespeicherte Version wird endgültig entfernt. Der aktuelle Plan bleibt unverändert."
        confirmLabel="Endgültig löschen"
        destructive
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await deleteTemplateVersion(remove.id);
          setRemove(null);
          toast.show('Version gelöscht.', 'info');
        }}
      />
    </>
  );
}
