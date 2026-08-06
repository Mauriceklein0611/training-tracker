import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type * as BrandConfig from '@/config/brand';
import { db } from '@/db/db';
import { setLanguage } from '@/i18n';
import { todayKey } from '@/utils/date';
import { resetDatabase } from '@/tests/dbTestUtils';
import { readOnboardingState } from '@/services/onboarding';
import { OnboardingDialog } from '@/features/onboarding/OnboardingDialog';

vi.mock('@/config/brand', async (importOriginal) => {
  const actual = await importOriginal<typeof BrandConfig>();
  return {
    ...actual,
    appOrigin: () => 'canonical' as const,
    isLegacyMigrationAvailable: () => true,
  };
});

function renderDialog() {
  return render(
    <MemoryRouter>
      <OnboardingDialog />
    </MemoryRouter>,
  );
}

async function openMigrationStep() {
  const user = userEvent.setup();
  renderDialog();
  expect(await screen.findByRole('heading', { level: 2 })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  return user;
}

beforeEach(async () => {
  localStorage.clear();
  await resetDatabase();
});

describe('OnboardingDialog migration entry', () => {
  it('opens the legacy app only by explicit choice and continues fresh on No', async () => {
    const user = await openMigrationStep();

    expect(
      screen.getByRole('heading', { name: 'Hast du die alte App schon benutzt?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ja, alte App für Backup öffnen' }),
    ).toHaveAttribute('href', 'https://training-tracker-4xu.pages.dev/');
    expect(
      screen.getByRole('button', { name: 'Backup importieren' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nein, neu starten' }));
    expect(
      screen.getByRole('heading', { name: 'Deine Körperdaten' }),
    ).toBeInTheDocument();
  });

  it('renders the migration choice fully in English', async () => {
    setLanguage('en');
    await openMigrationStep();

    expect(
      screen.getByRole('heading', { name: 'Have you used the old app before?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Yes, open the old app for backup' }),
    ).toHaveAttribute('href', 'https://training-tracker-4xu.pages.dev/');
    expect(screen.getByRole('button', { name: 'No, start fresh' })).toBeInTheDocument();
  });

  it('stores the optional body data as settings height and a dated weight entry', async () => {
    const user = await openMigrationStep();
    await user.click(screen.getByRole('button', { name: 'Nein, neu starten' }));

    await user.type(screen.getByLabelText('Größe (cm)'), '183');
    await user.type(screen.getByLabelText('Gewicht (kg)'), '81,5');
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(async () => {
      expect((await db.settings.get('app-settings'))?.heightCm).toBe(183);
    });
    const entries = await db.bodyWeightEntries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: todayKey(), weightKg: 81.5 });
  });

  it('keeps an implausible height in the step instead of storing it', async () => {
    const user = await openMigrationStep();
    await user.click(screen.getByRole('button', { name: 'Nein, neu starten' }));

    await user.type(screen.getByLabelText('Größe (cm)'), '1830');
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Größe bitte zwischen 50 und 280/,
    );
    expect(
      screen.getByRole('heading', { name: 'Deine Körperdaten' }),
    ).toBeInTheDocument();
    expect((await db.settings.get('app-settings'))?.heightCm).toBeUndefined();
  });

  it('stores dismissal so the welcome dialog is not shown again', async () => {
    const user = userEvent.setup();
    const firstRender = renderDialog();
    expect(
      await screen.findByRole('heading', { name: 'Willkommen bei Exerivo' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Überspringen' }));
    expect(readOnboardingState()).toMatchObject({ completed: true });
    firstRender.unmount();

    renderDialog();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Willkommen bei Exerivo' }),
      ).not.toBeInTheDocument();
    });
  });
});
