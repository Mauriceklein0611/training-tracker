import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db/db';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { setLanguage } from '@/i18n';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings } from '@/hooks/useSettings';
import { resetDatabase } from '@/tests/dbTestUtils';
import SettingsPage from '@/pages/SettingsPage';

/**
 * Mirrors what `App` does: the stored preference is applied by `useLanguage` one
 * level above the page, so the test exercises the real integration instead of
 * the page in isolation.
 */
function Harness() {
  const { settings } = useSettings();
  useLanguage(settings.language);
  return <SettingsPage />;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
}

/** jsdom reports en-US; these tests act as a German device unless stated. */
function setDeviceLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  });
}

beforeEach(async () => {
  await resetDatabase();
  await getSettings();
  setDeviceLanguages(['de-DE', 'de']);
  setLanguage('de');
});

afterEach(() => {
  setDeviceLanguages(['en-US']);
  setLanguage('de');
});

describe('SettingsPage language section', () => {
  it('offers automatic, German and English', async () => {
    renderPage();
    const select = await screen.findByLabelText('App-Sprache');
    expect(select).toHaveValue('auto');
    expect(
      [...(select as HTMLSelectElement).options].map((option) => option.value),
    ).toEqual(['auto', 'de', 'en']);
    expect(
      screen.getByRole('option', { name: 'Automatisch (Systemsprache)' }),
    ).toBeInTheDocument();
  });

  it('stores a manual choice and switches the visible copy without a reload', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(await screen.findByLabelText('App-Sprache'), 'en');

    // Persisted for the next start …
    await waitFor(async () => {
      expect((await db.settings.get('app-settings'))?.language).toBe('en');
    });
    // … and the page itself is already English, in place.
    await waitFor(() => {
      expect(screen.getByLabelText('App language')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'RPE (effort)' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'RIR (reps in reserve)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No entry' })).toBeInTheDocument();
  });

  it('renders a stored English preference on load, fully in English', async () => {
    await updateSettings({ language: 'en' });
    setLanguage('en');
    const { container } = renderPage();

    expect(await screen.findByLabelText('App language')).toHaveValue('en');
    expect(screen.getByRole('heading', { name: 'Rest signal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Backup reminder' })).toBeInTheDocument();
    // No German leftovers anywhere on the screen.
    expect(container.textContent).not.toMatch(
      /Einstellungen|Pausensignal|Darstellung|Sicherungserinnerung|Wochenziele/,
    );
  });

  it('follows the device language while the preference is automatic', async () => {
    // Same stored preference ("auto"), different device → different language.
    setDeviceLanguages(['en-US']);
    renderPage();
    expect(await screen.findByLabelText('App language')).toHaveValue('auto');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('keeps the German screen free of English leftovers', async () => {
    const { container } = renderPage();
    expect(await screen.findByLabelText('App-Sprache')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /Settings|Appearance|Rest signal|Backup reminder/,
    );
  });
});
