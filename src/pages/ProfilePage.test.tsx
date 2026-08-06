import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db/db';
import { getSettings } from '@/db/repositories/settings';
import { upsertBodyWeightEntry } from '@/db/repositories/bodyWeight';
import { resetDatabase } from '@/tests/dbTestUtils';
import { todayKey } from '@/utils/date';
import ProfilePage from '@/pages/ProfilePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDatabase();
  await getSettings();
});

describe('ProfilePage', () => {
  it('stores the name for the greeting', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Name'), '  Maurice  ');
    await user.tab();

    await waitFor(async () => {
      expect((await db.settings.get('app-settings'))?.displayName).toBe('Maurice');
    });
  });

  it('stores the birth date and shows the derived age', async () => {
    const user = userEvent.setup();
    renderPage();

    // The age itself is never stored, so it can never go stale.
    await user.type(await screen.findByLabelText('Geburtsdatum'), '1996-08-06');

    await waitFor(async () => {
      const settings = await db.settings.get('app-settings');
      expect(settings?.birthDate).toBe('1996-08-06');
      expect('age' in (settings ?? {})).toBe(false);
    });
    expect(await screen.findByText(/Jahre$/)).toBeInTheDocument();
  });

  it('rejects an implausible height instead of storing it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/Körpergröße/), '320');

    expect(await screen.findByRole('alert')).toHaveTextContent(/zwischen 50 und 280/);
    expect((await db.settings.get('app-settings'))?.heightCm).toBeUndefined();
  });

  it('shows the current weight read-only and links to the body diary', async () => {
    await upsertBodyWeightEntry({ date: todayKey(), weightKg: 81.5 });
    renderPage();

    // The weight has one place of entry only — here it is context, not a field.
    expect(await screen.findByText(/81,5/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Körpergewicht erfassen' })).toHaveAttribute(
      'href',
      '/mehr/koerpergewicht',
    );
    expect(screen.queryByLabelText(/Gewicht \(kg\)/)).not.toBeInTheDocument();
  });

  it('computes the BMI from height and current weight', async () => {
    const user = userEvent.setup();
    await upsertBodyWeightEntry({ date: todayKey(), weightKg: 81 });
    renderPage();

    await user.type(await screen.findByLabelText(/Körpergröße/), '180');

    expect(await screen.findByText('25,0')).toBeInTheDocument();
  });
});
