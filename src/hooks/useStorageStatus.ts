import { useCallback, useEffect, useState } from 'react';
import {
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from '@/services/storage';

/** Reads the storage status and exposes a way to request persistence. */
export function useStorageStatus(): {
  status: StorageStatus | null;
  refresh: () => Promise<void>;
  requestPersistence: () => Promise<boolean>;
} {
  const [status, setStatus] = useState<StorageStatus | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await readStorageStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestPersistence = useCallback(async () => {
    const granted = await requestPersistentStorage();
    await refresh();
    return granted;
  }, [refresh]);

  return { status, refresh, requestPersistence };
}
