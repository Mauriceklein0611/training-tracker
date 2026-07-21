import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

/**
 * Modal built on the native `<dialog>` element, which gives focus trapping,
 * Escape handling and inertness of the background for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Clicking the backdrop (the dialog element itself, outside the panel) closes.
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === ref.current) onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={ref}
      onClick={handleClick}
      aria-labelledby="dialog-title"
      className={cn(
        'w-[min(100vw-1.5rem,32rem)] rounded-2xl border border-border bg-surface p-0 text-text',
        'backdrop:bg-black/70 open:flex open:flex-col',
        size === 'lg' && 'w-[min(100vw-1.5rem,44rem)]',
      )}
    >
      <div className="max-h-[85vh] overflow-y-auto p-4">
        <h2 id="dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border p-3">
        {footer ?? (
          <Button onClick={onClose} variant="secondary">
            Schließen
          </Button>
        )}
      </div>
    </dialog>
  );
}

/**
 * Confirmation for destructive or hard-to-undo actions.
 * Nothing in the app deletes training data without going through this.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  destructive = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
