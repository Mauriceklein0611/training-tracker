import { db, ensureSettings } from '@/db/db';

/**
 * Drops and recreates the singleton database so each test starts from a known
 * empty state. The application itself never deletes the database.
 */
export async function resetDatabase(): Promise<void> {
  if (db.isOpen()) db.close();
  await db.delete();
  await db.open();
  await ensureSettings();
}
