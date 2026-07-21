import { db, ensureSettings } from '@/db/db';
import type { AppSettings } from '@/types';
import { nowIso } from '@/utils/id';

export async function getSettings(): Promise<AppSettings> {
  return ensureSettings();
}

export async function updateSettings(
  changes: Partial<Omit<AppSettings, 'id' | 'createdAt'>>,
): Promise<AppSettings> {
  const current = await ensureSettings();
  const next: AppSettings = { ...current, ...changes, updatedAt: nowIso() };
  await db.settings.put(next);
  return next;
}

/** Records that a full backup was written — drives the backup reminder. */
export async function markBackupCreated(at: string = nowIso()): Promise<void> {
  await updateSettings({ lastBackupAt: at });
}
