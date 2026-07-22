/**
 * Browser storage capabilities.
 *
 * Every call is defensive: the Storage API is missing on older iOS Safari and
 * inside some private browsing modes, and the app must keep working without it.
 */

export interface StorageStatus {
  /** The browser exposes navigator.storage at all. */
  supported: boolean;
  /** Persistent storage has been granted (data is not evicted under pressure). */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage) {
    return { supported: false, persisted: null, usageBytes: null, quotaBytes: null };
  }

  let persisted: boolean | null = null;
  try {
    persisted =
      typeof storage.persisted === 'function' ? await storage.persisted() : null;
  } catch {
    persisted = null;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    if (typeof storage.estimate === 'function') {
      const estimate = await storage.estimate();
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    }
  } catch {
    // Estimates are a nice-to-have; ignore failures.
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}

/**
 * Asks the browser to keep the data even when storage runs low.
 * Returns the resulting state; `false` simply means the browser declined.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.persist !== 'function') return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return 'unbekannt';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** True when the last backup is older than the configured reminder interval. */
export function isBackupOverdue(
  lastBackupAt: string | undefined,
  reminderDays: number,
  now: Date = new Date(),
): boolean {
  if (reminderDays <= 0) return false;
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > reminderDays * 24 * 3600 * 1000;
}
