import '@testing-library/jest-dom/vitest';
// In-memory IndexedDB implementation for tests. The real application always
// uses the browser's native IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setLanguage } from '@/i18n';

// The suite asserts German copy unless a test switches the language itself, so
// every test starts from a defined language instead of jsdom's `en-US` default.
beforeEach(() => {
  setLanguage('de');
});

afterEach(() => {
  cleanup();
  setLanguage('de');
});

// jsdom does not implement these; several components probe for them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
