import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { openDatabase } from '@/db/db';
import { seedSystemExercises } from '@/services/exerciseSeed';
import { requestPersistentStorage } from '@/services/storage';
import { Button } from '@/components/ui/Button';

type State =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/**
 * Opens IndexedDB before any screen renders.
 *
 * If the database cannot be opened the app shows an explanation instead of a
 * blank page — most commonly this happens in private browsing modes where
 * IndexedDB is unavailable.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await openDatabase();
        // Top up the curated system exercise catalog (idempotent). A failure
        // here must not keep the app from opening — it is only reference data.
        try {
          await seedSystemExercises();
        } catch {
          /* ignore — the app works without the extra catalog entries */
        }
        if (cancelled) return;
        setState({ status: 'ready' });
        // Ask the browser to keep the data. Declined or unsupported is fine —
        // the settings screen shows the result and lets the user retry.
        void requestPersistentStorage();
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-muted" role="status">
          {t('shell.openingDatabase')}
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="mt-8 rounded-2xl border border-danger/50 bg-surface p-5">
          <h1 className="text-lg font-semibold text-danger">
            {t('shell.storageUnavailableTitle')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{state.message}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{t('shell.storageHintPrivateMode')}</li>
            <li>{t('shell.storageHintBlocked')}</li>
            <li>{t('shell.storageHintSpace')}</li>
          </ul>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {t('action.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
