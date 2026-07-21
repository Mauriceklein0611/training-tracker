import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from '@/components/ui/toastContext';

/** Access to the toast queue. Falls back to a no-op outside the provider. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? { show: () => undefined };
}
