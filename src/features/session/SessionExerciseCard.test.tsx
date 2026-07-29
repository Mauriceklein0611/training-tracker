import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { resetDatabase } from '@/tests/dbTestUtils';
import { makeSessionExercise, makeSet } from '@/tests/factories';
import { SessionExerciseCard } from '@/features/session/SessionExerciseCard';
import type { SessionExerciseDetail } from '@/db/repositories/sessions';

beforeEach(async () => {
  await resetDatabase();
});

function renderCard(detail: SessionExerciseDetail) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <SessionExerciseCard detail={detail} sessionId="s1" index={0} total={1} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function detailFor(targetSetsSnapshot: number): SessionExerciseDetail {
  return {
    sessionExercise: makeSessionExercise({
      id: 'se1',
      sessionId: 's1',
      exerciseId: 'ex1',
      exerciseNameSnapshot: 'Bankdrücken',
      targetSetsSnapshot,
    }),
    sets: [
      makeSet({
        id: 'set1',
        sessionExerciseId: 'se1',
        setType: 'working',
        weightKg: 80,
        reps: 8,
        completedAt: '2026-07-06T10:00:00.000Z',
      }),
    ],
  };
}

describe('SessionExerciseCard collapse', () => {
  it('collapses a finished exercise and expands it on tap', async () => {
    renderCard(detailFor(1)); // 1 of 1 sets done → finished

    // Collapsed: a "done" summary, and the move controls are hidden.
    expect(await screen.findByText(/Abgeschlossen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nach oben/ })).not.toBeInTheDocument();

    // Tapping the row expands it to reveal the full controls.
    await userEvent.click(screen.getByRole('button', { name: /Bankdrücken/ }));
    expect(await screen.findByRole('button', { name: /nach oben/ })).toBeInTheDocument();
  });

  it('keeps an unfinished exercise expanded', () => {
    renderCard(detailFor(3)); // 1 of 3 sets done → still in progress

    expect(screen.getByRole('button', { name: /nach oben/ })).toBeInTheDocument();
    expect(screen.queryByText(/Abgeschlossen ·/)).not.toBeInTheDocument();
  });
});
