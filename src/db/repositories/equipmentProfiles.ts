import { db } from '@/db/db';
import { updateSettings } from '@/db/repositories/settings';
import type { EquipmentProfile, Exercise } from '@/types';
import { nowIso, uuid } from '@/utils/id';

/** Equipment profiles: named sets of available equipment for filtering exercises. */

export async function listEquipmentProfiles(): Promise<EquipmentProfile[]> {
  const profiles = await db.equipmentProfiles.toArray();
  return profiles.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function createEquipmentProfile(
  name: string,
  equipment: string[] = [],
): Promise<EquipmentProfile> {
  const timestamp = nowIso();
  const profile: EquipmentProfile = {
    id: uuid(),
    name: name.trim(),
    equipment: normalizeEquipment(equipment),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.equipmentProfiles.add(profile);
  return profile;
}

export async function updateEquipmentProfile(
  id: string,
  changes: Partial<Pick<EquipmentProfile, 'name' | 'equipment'>>,
): Promise<void> {
  const next: Partial<EquipmentProfile> = { ...changes, updatedAt: nowIso() };
  if (changes.name != null) next.name = changes.name.trim();
  if (changes.equipment != null) next.equipment = normalizeEquipment(changes.equipment);
  await db.equipmentProfiles.update(id, next);
}

/** Deletes a profile; clears the active selection if it pointed here. */
export async function deleteEquipmentProfile(id: string): Promise<void> {
  await db.transaction('rw', db.equipmentProfiles, db.settings, async () => {
    await db.equipmentProfiles.delete(id);
    const settings = await db.settings.get('app-settings');
    if (settings?.activeEquipmentProfileId === id) {
      await updateSettings({ activeEquipmentProfileId: undefined });
    }
  });
}

export async function setActiveEquipmentProfile(id: string | undefined): Promise<void> {
  await updateSettings({ activeEquipmentProfileId: id });
}

/** Trimmed, de-duplicated, non-empty equipment names. */
function normalizeEquipment(equipment: string[]): string[] {
  return [...new Set(equipment.map((item) => item.trim()).filter(Boolean))];
}

/**
 * Whether an exercise is available under a profile. Exercises without any
 * equipment are always available; otherwise the equipment must be listed
 * (case-insensitive). A null profile means "everything is available".
 */
export function isExerciseAvailable(
  exercise: Pick<Exercise, 'equipment'>,
  profile: EquipmentProfile | null | undefined,
): boolean {
  if (!profile) return true;
  const equipment = exercise.equipment?.trim();
  if (!equipment) return true;
  const allowed = new Set(profile.equipment.map((item) => item.toLowerCase()));
  return allowed.has(equipment.toLowerCase());
}
