import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '@/i18n';
import MorePage from '@/pages/MorePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <MorePage />
    </MemoryRouter>,
  );
}

beforeEach(() => setLanguage('de'));
afterEach(() => setLanguage('de'));

describe('MorePage', () => {
  it('renders the hub in German with grouped entries', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Mehr' })).toBeInTheDocument();
    for (const group of ['Training', 'Fortschritt', 'Daten', 'App']) {
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Bibliothek/ })).toHaveAttribute(
      'href',
      '/bibliothek',
    );
    expect(screen.getByRole('link', { name: /Einstellungen/ })).toHaveAttribute(
      'href',
      '/mehr/einstellungen',
    );
  });

  it('renders the hub in English without German leftovers', () => {
    setLanguage('en');
    const { container } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'More' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Library/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data & backup/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /Bibliothek|Einstellungen|Datenschutz|Körperdaten|Sicherung/,
    );
  });

  it('keeps routes language independent — a bookmark stays valid', () => {
    setLanguage('en');
    renderPage();
    // URLs are stable identifiers, not UI copy.
    expect(screen.getByRole('link', { name: /Glossary/ })).toHaveAttribute(
      'href',
      '/mehr/glossar',
    );
  });

  it('shows the support card above the tool groups', () => {
    const { container } = renderPage();
    const card = screen.getByText('Kostenlos. Privat. Unabhängig.');
    const firstGroup = screen.getByRole('heading', { name: 'Training' });
    // Document order: the project card comes first.
    expect(
      card.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.textContent).toContain('Feedback geben');
  });
});
