import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import {
  createEquipmentProfile,
  deleteEquipmentProfile,
  isExerciseAvailable,
  listEquipmentProfiles,
  setActiveEquipmentProfile,
  updateEquipmentProfile,
} from '@/db/repositories/equipmentProfiles';
import { createBackup, importBackup } from '@/services/backup';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { EquipmentProfile } from '@/types';

beforeEach(async () => {
  await resetDatabase();
});

describe('isExerciseAvailable', () => {
  const profile: EquipmentProfile = {
    id: 'p1',
    name: 'Zuhause',
    equipment: ['Kurzhantel', 'Klimmzugstange'],
    createdAt: '',
    updatedAt: '',
  };

  it('is always true without an active profile', () => {
    expect(isExerciseAvailable({ equipment: 'Langhantel' }, null)).toBe(true);
  });

  it('is true for exercises without equipment', () => {
    expect(isExerciseAvailable({ equipment: '' }, profile)).toBe(true);
  });

  it('matches equipment case-insensitively', () => {
    expect(isExerciseAvailable({ equipment: 'kurzhantel' }, profile)).toBe(true);
    expect(isExerciseAvailable({ equipment: 'Langhantel' }, profile)).toBe(false);
  });
});

describe('equipment profile repository', () => {
  it('creates, normalises and lists profiles', async () => {
    await createEquipmentProfile('Hotel', ['Kurzhantel', ' Kurzhantel ', '']);
    const profiles = await listEquipmentProfiles();
    expect(profiles).toHaveLength(1);
    // Trimmed and de-duplicated.
    expect(profiles[0].equipment).toEqual(['Kurzhantel']);
  });

  it('clears the active selection when the active profile is deleted', async () => {
    const profile = await createEquipmentProfile('Gym', ['Langhantel']);
    await setActiveEquipmentProfile(profile.id);
    expect((await db.settings.get('app-settings'))?.activeEquipmentProfileId).toBe(
      profile.id,
    );

    await deleteEquipmentProfile(profile.id);
    expect(
      (await db.settings.get('app-settings'))?.activeEquipmentProfileId,
    ).toBeUndefined();
  });

  it('survives a backup round trip including the active selection', async () => {
    const profile = await createEquipmentProfile('Zuhause', ['Kurzhantel']);
    await updateEquipmentProfile(profile.id, { equipment: ['Kurzhantel', 'Band'] });
    await setActiveEquipmentProfile(profile.id);

    const backup = await createBackup();
    expect(backup.equipmentProfiles).toHaveLength(1);

    await resetDatabase();
    await importBackup(backup, 'replace');

    const restored = (await listEquipmentProfiles())[0];
    expect(restored.equipment).toEqual(['Kurzhantel', 'Band']);
    expect((await db.settings.get('app-settings'))?.activeEquipmentProfileId).toBe(
      profile.id,
    );
  });
});
