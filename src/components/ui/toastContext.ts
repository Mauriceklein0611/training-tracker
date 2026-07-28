import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** An optional action button, e.g. "Rückgängig". */
  action?: ToastAction;
  /** How long the toast stays, in ms (default 4000; undo actions use longer). */
  durationMs?: number;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

export interface ToastContextValue {
  show: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
}

/**
 * Lives in its own module so `ToastProvider.tsx` only exports components,
 * which keeps React Fast Refresh working during development.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
