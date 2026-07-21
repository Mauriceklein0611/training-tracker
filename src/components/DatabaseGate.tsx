import { useEffect, useState, type ReactNode } from 'react';
import { openDatabase } from '@/db/db';
import { requestPersistentStorage } from '@/services/storage';
import { Button } from '@/components/ui/Button';

type State = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/**
 * Opens IndexedDB before any screen renders.
 *
 * If the database cannot be opened the app shows an explanation instead of a
 * blank page — most commonly this happens in private browsing modes where
 * IndexedDB is unavailable.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await openDatabase();
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
          Lokale Datenbank wird geöffnet …
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="mt-8 rounded-2xl border border-danger/50 bg-surface p-5">
          <h1 className="text-lg font-semibold text-danger">
            Lokaler Speicher nicht verfügbar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{state.message}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Privaten Modus beenden und die App normal öffnen.</li>
            <li>Prüfen, ob der Browser Websitedaten blockiert.</li>
            <li>Genügend freien Speicher auf dem Gerät sicherstellen.</li>
          </ul>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
