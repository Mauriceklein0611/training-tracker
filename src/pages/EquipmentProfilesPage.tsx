import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
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

export default function EquipmentProfilesPage() {
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
      ].sort((a, b) => a.localeCompare(b, 'de')),
    [exercises],
  );

  const activeId = settings.activeEquipmentProfileId;

  return (
    <>
      <PageHeader
        title="Equipment-Profile"
        subtitle="Optional — blenden Übungen aus, deren Equipment gerade fehlt"
        backTo="/mehr"
      />

      <Card className="mb-4">
        <CardHeader
          title="Aktives Profil"
          subtitle="Wirkt beim Hinzufügen von Übungen im Plan und im Training."
          as="h2"
        />
        <p className="text-sm">
          {activeId
            ? (profiles.find((profile) => profile.id === activeId)?.name ?? 'Unbekannt')
            : 'Kein Profil aktiv — alle Übungen verfügbar.'}
        </p>
        {activeId ? (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void setActiveEquipmentProfile(undefined)}
          >
            Profil deaktivieren
          </Button>
        ) : null}
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Profile</h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
          <Plus size={18} aria-hidden="true" />
          Neu
        </Button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={26} aria-hidden="true" />}
          title="Noch keine Profile"
          description="Lege z. B. Zuhause, Fitnessstudio oder Hotel an und wähle das jeweils verfügbare Equipment. Beim Hinzufügen von Übungen kannst du dann auf die verfügbaren beschränken."
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
                    {profile.id === activeId ? <Badge tone="success">aktiv</Badge> : null}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {profile.equipment.length > 0
                      ? profile.equipment.join(', ')
                      : 'Kein Equipment gewählt'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={`${profile.name} bearbeiten`}
                    onClick={() => setEditing(profile)}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`${profile.name} löschen`}
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
                  Aktivieren
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
            toast.show('Profil gespeichert.', 'success');
          }}
        />
      ) : null}

      <ConfirmDialog
        open={remove != null}
        title="Profil löschen?"
        description="Das Equipment-Profil wird entfernt. Deine Übungen bleiben unverändert."
        confirmLabel="Löschen"
        destructive
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await deleteEquipmentProfile(remove.id);
          setRemove(null);
          toast.show('Profil gelöscht.', 'info');
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
  const [name, setName] = useState(profile?.name ?? '');
  const [selected, setSelected] = useState<string[]>(profile?.equipment ?? []);
  const [custom, setCustom] = useState('');

  // Every option to show: known equipment plus anything already on the profile.
  const options = useMemo(
    () =>
      [...new Set([...knownEquipment, ...selected])].sort((a, b) =>
        a.localeCompare(b, 'de'),
      ),
    [knownEquipment, selected],
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
      title={profile ? 'Profil bearbeiten' : 'Neues Profil'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => void handleSave()}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Name"
          value={name}
          placeholder="z. B. Zuhause"
          onChange={(event) => setName(event.target.value)}
        />

        <div>
          <p className="mb-2 text-sm font-medium">Verfügbares Equipment</p>
          {options.length === 0 ? (
            <p className="text-xs text-muted">
              Noch kein Equipment bekannt. Füge unten welches hinzu.
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
                  <span className="min-w-0 truncate">{item}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <TextField
            label="Equipment hinzufügen"
            containerClassName="flex-1"
            value={custom}
            placeholder="z. B. Kettlebell"
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
