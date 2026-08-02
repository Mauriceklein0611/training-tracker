import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import GuidePage from '@/pages/GuidePage';
import { setLanguage } from '@/i18n';

function renderGuide(path = '/hilfe') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hilfe" element={<GuidePage />} />
        <Route path="/hilfe/:articleId" element={<GuidePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuidePage', () => {
  it('searches the bundled German guide content', () => {
    renderGuide();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Domainwechsel' },
    });
    expect(
      screen.getByRole('heading', { name: 'Backup, Import und Domainwechsel' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Cardio tracken' }),
    ).not.toBeInTheDocument();
  });

  it('opens a deep-linked article in English', () => {
    setLanguage('en');
    renderGuide('/hilfe/backup-import');
    expect(
      screen.getByRole('heading', { name: 'Backup, import and domain move' }),
    ).toBeVisible();
    expect(screen.getByText(/do not share local storage/i)).toBeVisible();
  });

  it('provides a detailed plan tutorial without a fake helpfulness poll', () => {
    renderGuide('/hilfe/trainingsplaene');

    expect(
      screen.getByRole('heading', { name: 'Trainingspläne Schritt für Schritt' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Freie Rotation oder feste Wochentage' }),
    ).toBeVisible();
    expect(screen.getByText(/Arbeitssätze und passende Zielwerte/)).toBeVisible();
    expect(screen.queryByText('War das hilfreich?')).not.toBeInTheDocument();
  });
});
