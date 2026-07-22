/**
 * Service worker registration.
 *
 * Registered by hand rather than through the plugin's virtual module, so the
 * app can be imported in tests and in environments where the PWA plugin is not
 * active without pulling in a module that does not exist there.
 *
 * Important: the service worker only ever caches the static app shell. All
 * training data lives in IndexedDB, which a service worker update never
 * touches — installing a new version keeps every workout intact.
 */

export interface ServiceWorkerHandle {
  /** A new version has been downloaded and is waiting to take over. */
  onUpdateAvailable: (callback: () => void) => void;
  /** Activates the waiting worker and reloads once it is in control. */
  applyUpdate: () => Promise<void>;
}

let waitingWorker: ServiceWorker | null = null;
let updateCallback: (() => void) | null = null;

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export async function registerServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;
  // The generated worker only exists in a production build.
  if (!import.meta.env.PROD) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    const notifyIfWaiting = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        updateCallback?.();
      }
    };

    notifyIfWaiting();

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') notifyIfWaiting();
      });
    });

    // Check for a new deployment whenever the app is brought back to the front.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void registration.update().catch(() => undefined);
      }
    });
  } catch (error) {
    console.warn('Service Worker konnte nicht registriert werden:', error);
  }
}

export function onServiceWorkerUpdate(callback: () => void): void {
  updateCallback = callback;
  if (waitingWorker) callback();
}

/**
 * Tells the waiting worker to activate, then reloads once it controls the page.
 * A guard prevents the reload loop some browsers trigger on controllerchange.
 */
export async function applyServiceWorkerUpdate(): Promise<void> {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });

  // Fallback if the worker does not honour the message.
  window.setTimeout(() => {
    if (!reloaded) {
      reloaded = true;
      window.location.reload();
    }
  }, 3000);
}

/** True when the app runs from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean })
    .standalone;
  return (
    iosStandalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac but has a touch screen.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
