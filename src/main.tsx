import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { DatabaseGate } from '@/components/DatabaseGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { applyTheme, readStoredTheme } from '@/hooks/useTheme';
import { applyDocumentLanguage } from '@/i18n';
import { registerServiceWorker } from '@/services/pwa';
import '@/index.css';

// Apply the last known theme before the first paint to avoid a bright flash.
applyTheme(readStoredTheme());
// Resolve the display language from the system and reflect it on <html lang>.
applyDocumentLanguage();

const container = document.getElementById('root');
if (!container) throw new Error('Root-Element wurde nicht gefunden.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <DatabaseGate>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DatabaseGate>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

void registerServiceWorker();
