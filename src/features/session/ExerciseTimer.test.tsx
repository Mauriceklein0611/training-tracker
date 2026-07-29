import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseTimer } from '@/features/session/ExerciseTimer';

/**
 * A7: cardio has a single completion action ("Abschnitt abschließen" in the
 * editor). The timer embedded in the cardio editor must therefore not offer its
 * own "apply and complete" action — only "apply the time".
 */
describe('ExerciseTimer completion action', () => {
  it('offers apply-and-complete for strength sets (default)', () => {
    render(
      <ExerciseTimer
        setId="s1"
        onApply={() => {}}
        soundEnabled={false}
        vibrationEnabled={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Zeit übernehmen und Satz abschließen' }),
    ).toBeInTheDocument();
  });

  it('hides its own completion when showComplete is false (cardio)', () => {
    render(
      <ExerciseTimer
        setId="s2"
        showComplete={false}
        onApply={() => {}}
        soundEnabled={false}
        vibrationEnabled={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Zeit übernehmen und Satz abschließen' }),
    ).not.toBeInTheDocument();
    // Only a plain "apply the time" action remains.
    expect(screen.getByRole('button', { name: 'Zeit übernehmen' })).toBeInTheDocument();
  });
});
