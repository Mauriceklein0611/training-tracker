import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { db } from '@/db/db';
import {
  createEquipmentProfile,
  deleteEquipmentProfile,
  listEquipmentProfiles,
  setActiveEquipmentProfile,
  updateEquipmentProfile,
} from '@/db/repositories/equipmentProfiles';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import type { EquipmentProfile } from '@/types';
import { freeEquipmentDisplayLabel } from '@/utils/format';

export default function EquipmentProfilesPage() {
  const { t, i18n } = useTranslation('more');
  const toast = useToast();
  const { settings } = useSettings();
  const profiles = useLiveQuery(() => listEquipmentProfiles(), [], []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], []);

  const [editing, setEditing] = useState<EquipmentProfile | 'new' | null>(null);
  const [remove, setRemove] = useState<EquipmentProfile | null>(null);

  const knownEquipment = useMemo(
    () =>
      [
        ...new Set(
          exercises.map((exercise) => exercise.equipment.trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, i18n.resolvedLanguage)),
    [exercises, i18n.resolvedLanguage],
  );

  const activeId = settings.activeEquipmentProfileId;

  return (
    <>
      <PageHeader
        title={t('screens.equipmentProfiles.title')}
        subtitle={t('screens.equipmentProfiles.subtitle')}
        backTo="/mehr"
      />

      <Card className="mb-4">
        <CardHeader
          title={t('screens.equipmentProfiles.active.title')}
          subtitle={t('screens.equipmentProfiles.active.subtitle')}
          as="h2"
        />
        <p className="text-sm">
          {activeId
            ? (profiles.find((profile) => profile.id === activeId)?.name ??
              t('screens.equipmentProfiles.active.unknown'))
            : t('screens.equipmentProfiles.active.none')}
        </p>
        {activeId ? (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void setActiveEquipmentProfile(undefined)}
          >
            {t('screens.equipmentProfiles.active.disable')}
          </Button>
        ) : null}
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {t('screens.equipmentProfiles.list.title')}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" />
          {t('screens.action.new')}
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={26} aria-hidden="true" />}
          title={t('screens.equipmentProfiles.list.emptyTitle')}
          description={t('screens.equipmentProfiles.list.emptyDescription')}
        />
      ) : (
        <ul className="grid gap-2">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {profile.name}
                    {profile.id === activeId ? (
                      <Badge tone="success">
                        {t('screens.equipmentProfiles.list.activeBadge')}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {profile.equipment.length > 0
                      ? profile.equipment.map(freeEquipmentDisplayLabel).join(', ')
                      : t('screens.equipmentProfiles.list.noneSelected')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={t('screens.equipmentProfiles.list.edit', {
                      name: profile.name,
                    })}
                    onClick={() => setEditing(profile)}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={t('screens.equipmentProfiles.list.delete', {
                      name: profile.name,
                    })}
                    onClick={() => setRemove(profile)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
              {profile.id !== activeId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void setActiveEquipmentProfile(profile.id)}
                >
                  <Check size={16} aria-hidden="true" />
                  {t('screens.equipmentProfiles.list.activate')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ProfileEditor
          profile={editing === 'new' ? null : editing}
          knownEquipment={knownEquipment}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show(t('screens.equipmentProfiles.toast.saved'), 'success');
          }}
        />
      ) : null}

      <ConfirmDialog
        open={remove != null}
        title={t('screens.equipmentProfiles.deleteDialog.title')}
        description={t('screens.equipmentProfiles.deleteDialog.description')}
        confirmLabel={t('screens.action.delete')}
        destructive
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await deleteEquipmentProfile(remove.id);
          setRemove(null);
          toast.show(t('screens.equipmentProfiles.toast.deleted'), 'info');
        }}
      />
    </>
  );
}

function ProfileEditor({
  profile,
  knownEquipment,
  onClose,
  onSaved,
}: {
  profile: EquipmentProfile | null;
  knownEquipment: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation('more');
  const [name, setName] = useState(profile?.name ?? '');
  const [selected, setSelected] = useState<string[]>(profile?.equipment ?? []);
  const [custom, setCustom] = useState('');

  // Every option to show: known equipment plus anything already on the profile.
  const options = useMemo(
    () =>
      [...new Set([...knownEquipment, ...selected])].sort((a, b) =>
        a.localeCompare(b, i18n.resolvedLanguage),
      ),
    [knownEquipment, selected, i18n.resolvedLanguage],
  );

  const toggle = (item: string) =>
    setSelected((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item],
    );

  const addCustom = () => {
    const value = custom.trim();
    if (value && !selected.includes(value)) setSelected((current) => [...current, value]);
    setCustom('');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (profile) await updateEquipmentProfile(profile.id, { name, equipment: selected });
    else await createEquipmentProfile(name, selected);
    onSaved();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        profile
          ? t('screens.equipmentProfiles.editor.editTitle')
          : t('screens.equipmentProfiles.editor.newTitle')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('screens.action.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => void handleSave()}
          >
            {t('screens.action.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label={t('screens.equipmentProfiles.editor.name')}
          value={name}
          placeholder={t('screens.equipmentProfiles.editor.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />

        <div>
          <p className="mb-2 text-sm font-medium">
            {t('screens.equipmentProfiles.editor.equipment')}
          </p>
          {options.length === 0 ? (
            <p className="text-xs text-muted">
              {t('screens.equipmentProfiles.editor.emptyEquipment')}
            </p>
          ) : (
            <div className="grid max-h-56 gap-1 overflow-y-auto">
              {options.map((item) => (
                <label key={item} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(item)}
                    className="h-5 w-5 accent-[var(--accent)]"
                    onChange={() => toggle(item)}
                  />
                  <span className="min-w-0 truncate">
                    {freeEquipmentDisplayLabel(item)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <TextField
            label={t('screens.equipmentProfiles.editor.addEquipment')}
            containerClassName="flex-1"
            value={custom}
            placeholder={t('screens.equipmentProfiles.editor.equipmentPlaceholder')}
            onChange={(event) => setCustom(event.target.value)}
          />
          <Button variant="secondary" onClick={addCustom} disabled={!custom.trim()}>
            <Plus size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
