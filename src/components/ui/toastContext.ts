import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

/**
 * Lives in its own module so `ToastProvider.tsx` only exports components,
 * which keeps React Fast Refresh working during development.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
