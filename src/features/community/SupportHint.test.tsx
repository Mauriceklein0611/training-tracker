import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLanguage } from '@/i18n';
import { SupportHint } from '@/features/community/SupportHint';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

function renderHint(overrides: Partial<Parameters<typeof SupportHint>[0]> = {}) {
  const props = {
    onShown: vi.fn(),
    onLater: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
  return { ...render(<SupportHint {...props} />), props };
}

beforeEach(() => {
  setLanguage('de');
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
  setLanguage('de');
});

describe('SupportHint', () => {
  it('is an inline card, not a modal', () => {
    renderHint();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Danke, dass du den Training Tracker nutzt/)).toBeVisible();
  });

  it('records that it was shown exactly once', () => {
    const { props } = renderHint();
    expect(props.onShown).toHaveBeenCalledTimes(1);
  });

  it('offers support and sharing as equals, plus postpone and permanent opt-out', () => {
    renderHint();
    expect(
      screen.getByRole('link', { name: /Projekt unterstützen/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App teilen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Später' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Nicht mehr anzeigen' }),
    ).toBeInTheDocument();
  });

  it('reports postponing and dismissing separately', async () => {
    const user = userEvent.setup();
    const { props, unmount } = renderHint();
    await user.click(screen.getByRole('button', { name: 'Später' }));
    expect(props.onLater).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).not.toHaveBeenCalled();
    unmount();

    const second = renderHint();
    await user.click(screen.getByRole('button', { name: 'Nicht mehr anzeigen' }));
    expect(second.props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('localises to English', () => {
    setLanguage('en');
    renderHint();
    expect(screen.getByText(/Thanks for using Training Tracker/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Don’t show again' })).toBeInTheDocument();
  });

  it('hides the external link offline but stays dismissible', () => {
    setOnline(false);
    renderHint();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Nicht mehr anzeigen' }),
    ).toBeInTheDocument();
  });

  it('never renders a dead support link', () => {
    renderHint({ kofiUrl: '' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps every control keyboard reachable', async () => {
    const user = userEvent.setup();
    renderHint();
    const order = [
      screen.getByRole('link', { name: /Projekt unterstützen/ }),
      screen.getByRole('button', { name: /App teilen/ }),
      screen.getByRole('button', { name: 'Später' }),
      screen.getByRole('button', { name: 'Nicht mehr anzeigen' }),
    ];
    for (const element of order) {
      await user.tab();
      expect(element).toHaveFocus();
    }
  });
});
