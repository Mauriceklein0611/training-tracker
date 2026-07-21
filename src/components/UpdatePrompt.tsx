import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { applyServiceWorkerUpdate, onServiceWorkerUpdate } from '@/services/pwa';

/**
 * Non-blocking banner shown when a new app version is ready.
 *
 * The update is never applied automatically: reloading in the middle of a
 * recorded set would be jarring, so the user decides when it happens.
 */
export function UpdatePrompt() {
  const [available, setAvailable] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    onServiceWorkerUpdate(() => setAvailable(true));
  }, []);

  if (!available) return null;

  return (
    <div
      role="status"
      className="toast-safe-top fixed inset-x-3 z-50 rounded-2xl border border-accent/50 bg-surface p-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <RefreshCw size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Neue Version verfügbar</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Deine Trainingsdaten bleiben beim Aktualisieren vollständig erhalten.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={applying}
          onClick={() => {
            setApplying(true);
            void applyServiceWorkerUpdate();
          }}
        >
          {applying ? 'Wird aktualisiert …' : 'Jetzt aktualisieren'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAvailable(false)}>
          Später
        </Button>
      </div>
    </div>
  );
}
