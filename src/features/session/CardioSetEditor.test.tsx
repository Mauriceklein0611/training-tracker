import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { makeSessionExercise, makeSet } from '@/tests/factories';
import { CardioSetEditor } from '@/features/session/CardioSetEditor';

/**
 * #17 / #22: cardio must never borrow strength wording. The single completion
 * action for a cardio section reads "Abschnitt abschließen", not
 * "Cardio abschließen" or anything with "Satz".
 */
describe('CardioSetEditor completion wording', () => {
  it('labels the completion action "Abschnitt abschließen"', () => {
    render(
      <ToastProvider>
        <CardioSetEditor
          set={makeSet({
            id: 'c1',
            sessionExerciseId: 'se1',
            setType: 'working',
            weightKg: undefined,
            reps: undefined,
            durationSeconds: 600,
            distanceMeters: 2000,
            completedAt: undefined,
          })}
          sessionExercise={makeSessionExercise({
            id: 'se1',
            trackingTypeSnapshot: 'cardio',
            cardioModalitySnapshot: 'running',
          })}
          onPersist={() => {}}
          onComplete={() => {}}
          onDelete={() => {}}
        />
      </ToastProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Abschnitt abschließen/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cardio abschließen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Satz abschließen/)).not.toBeInTheDocument();
  });
});
