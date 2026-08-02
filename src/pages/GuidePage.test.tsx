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
});
