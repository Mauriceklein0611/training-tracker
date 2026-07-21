import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { ToastContext, type Toast, type ToastTone } from '@/components/ui/toastContext';

let nextId = 1;

/**
 * Short confirmations ("Backup gespeichert", "Anweisung kopiert").
 *
 * Rendered in an aria-live region so the message is announced without moving
 * focus away from what the user was doing.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm shadow-lg',
              toast.tone === 'error'
                ? 'border-danger/50 bg-surface text-danger'
                : toast.tone === 'success'
                  ? 'border-success/50 bg-surface text-success'
                  : 'border-border bg-surface text-text',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
