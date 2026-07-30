import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  /** Shown instead of the generic message, e.g. for a specific page. */
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

// Kept beside the class boundary so the fallback can use the typed translation hook.
// eslint-disable-next-line react-refresh/only-export-components
function ErrorFallback({
  error,
  fallbackTitle,
  onReset,
}: {
  error: Error;
  fallbackTitle?: string;
  onReset: () => void;
}) {
  const { t } = useTranslation('more');

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-2xl border border-danger/50 bg-surface p-5">
        <h1 className="text-lg font-semibold text-danger">
          {fallbackTitle ?? t('screens.errorBoundary.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t('screens.errorBoundary.text')}
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-surface-2 p-3 text-xs text-muted">
          {error.message}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onReset}>
            {t('screens.errorBoundary.retry')}
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('screens.errorBoundary.reload')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Catches unexpected render errors so a single broken screen never takes the
 * whole app down — and, more importantly, never leaves the user wondering
 * whether their training data survived. Reloading is always safe: everything
 * is already committed to IndexedDB.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local only — no telemetry is ever sent anywhere.
    console.error('Unerwarteter Fehler in der Oberfläche:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        fallbackTitle={this.props.fallbackTitle}
        onReset={this.handleReset}
      />
    );
  }
}
