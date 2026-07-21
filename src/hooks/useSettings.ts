import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { DEFAULT_SETTINGS, db } from '@/db/db';
import { updateSettings } from '@/db/repositories/settings';
import type { AppSettings } from '@/types';

/**
 * Live view of the settings singleton.
 *
 * Returns the defaults until the row has been read, so no consumer has to deal
 * with an undefined settings object.
 */
export function useSettings(): {
  settings: AppSettings;
  loaded: boolean;
  update: (changes: Partial<Omit<AppSettings, 'id' | 'createdAt'>>) => Promise<void>;
} {
  const stored = useLiveQuery(() => db.settings.get('app-settings'), []);

  const update = useCallback(
    async (changes: Partial<Omit<AppSettings, 'id' | 'createdAt'>>) => {
      await updateSettings(changes);
    },
    [],
  );

  return {
    settings: stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS,
    loaded: stored !== undefined,
    update,
  };
}
