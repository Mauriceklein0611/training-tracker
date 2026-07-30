import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '@/i18n';
import { ActivePlanHero, type ActivePlanHeroData } from '@/features/home/ActivePlanHero';

afterEach(() => setLanguage('de'));

function renderHero(
  data: ActivePlanHeroData,
  onStartNext = vi.fn(),
  disabled = false,
  onConfigure = vi.fn(),
) {
  render(
    <MemoryRouter>
      <ActivePlanHero
        data={data}
        onStartNext={onStartNext}
        onConfigure={onConfigure}
        disabled={disabled}
      />
    </MemoryRouter>,
  );
  return { onStartNext, onConfigure };
}

const base: ActivePlanHeroData = {
  planId: 'p1',
  planName: 'Muskelaufbau 3er-Split',
  dayNames: ['Push', 'Pull', 'Beine'],
  nextUnit: {
    templateId: 'd3',
    name: 'Beine',
    exerciseCount: 6,
    estimatedMinutes: 55,
    lastDoneDaysAgo: 6,
  },
  cycleWeek: { current: 4, total: 8 },
};

describe('ActivePlanHero', () => {
  it('shows the plan, cycle week and next unit, and starts it', async () => {
    const { onStartNext: onStart } = renderHero(base);
    expect(screen.getByText('Muskelaufbau 3er-Split')).toBeInTheDocument();
    expect(screen.getByText('Woche 4 / 8')).toBeInTheDocument();
    // "Beine" appears as the next-unit line and as its split chip.
    expect(screen.getAllByText('Beine').length).toBeGreaterThanOrEqual(1);

    // The "Als Nächstes" details: exercise count, estimate and last-done.
    expect(
      screen.getByText(/6 Übungen · ca\. 55 Min\. · zuletzt vor 6 Tagen/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Training starten/ }));
    expect(onStart).toHaveBeenCalledWith('d3');
  });

  it('shows an active deload calmly with the remaining days', () => {
    renderHero({
      ...base,
      deload: {
        remainingDays: 5,
        endDate: '02.08.2026',
        intensityLabel: 'Mittel (−40 %)',
        percent: 0.4,
      },
    });
    expect(screen.getByText(/Deload aktiv · noch 5 Tage/)).toBeInTheDocument();
    expect(screen.getByText(/reduziert/)).toBeInTheDocument();
  });

  it('blocks starting while another session is active', () => {
    renderHero(base, vi.fn(), true);
    expect(screen.getByRole('button', { name: /Training starten/ })).toBeDisabled();
  });

  it('states plainly when there is no next unit', () => {
    renderHero({ ...base, nextUnit: undefined });
    expect(screen.getByText(/keine nächste Einheit geplant/)).toBeInTheDocument();
  });

  it('renders the same hero in English, with no German left', () => {
    setLanguage('en');
    const { container } = render(
      <MemoryRouter>
        <ActivePlanHero data={base} onStartNext={vi.fn()} onConfigure={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Active training plan')).toBeInTheDocument();
    expect(screen.getByText('Week 4 / 8')).toBeInTheDocument();
    expect(
      screen.getByText(/6 exercises · approx\. 55 min · last done 6 days ago/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start workout/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /Woche|Übungen|zuletzt|Training starten|Aktiver Trainingsplan/,
    );
  });

  it('counts one exercise and one deload day with the right singular', () => {
    const single = {
      ...base,
      nextUnit: { ...base.nextUnit!, exerciseCount: 1, lastDoneDaysAgo: 1 },
      deload: {
        remainingDays: 1,
        endDate: '02.08.2026',
        intensityLabel: 'Mittel (−40 %)',
        percent: 0.4,
      },
    };
    const german = render(
      <MemoryRouter>
        <ActivePlanHero data={single} onStartNext={vi.fn()} onConfigure={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/^1 Übung · /)).toBeInTheDocument();
    expect(screen.getByText(/zuletzt gestern/)).toBeInTheDocument();
    expect(screen.getByText(/noch 1 Tag$/)).toBeInTheDocument();
    german.unmount();

    setLanguage('en');
    render(
      <MemoryRouter>
        <ActivePlanHero data={single} onStartNext={vi.fn()} onConfigure={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/^1 exercise · /)).toBeInTheDocument();
    expect(screen.getByText(/1 day left$/)).toBeInTheDocument();
  });

  it('offers to configure an empty next unit instead of starting it', async () => {
    const { onStartNext, onConfigure } = renderHero({
      ...base,
      nextUnit: { ...base.nextUnit!, exerciseCount: 0 },
    });
    expect(screen.getByText(/noch keine Übungen/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Training starten/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Einheit konfigurieren/ }));
    expect(onConfigure).toHaveBeenCalledWith('d3');
    expect(onStartNext).not.toHaveBeenCalled();
  });
});
