import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateExerciseRow } from '@/features/templates/TemplateExerciseRow';
import { setLanguage } from '@/i18n';
import { makeExercise } from '@/tests/factories';
import type { TemplateExercise } from '@/types';

const entry: TemplateExercise = {
  id: 'te-1',
  templateId: 'day-a',
  exerciseId: 'exercise-1',
  order: 0,
  targetSets: 3,
  targetRepMin: 8,
  targetRepMax: 12,
  restSeconds: 120,
  notes: '',
};

function renderRow() {
  return render(
    <TemplateExerciseRow
      entry={entry}
      exercise={makeExercise({ id: 'exercise-1', name: 'Bankdrücken' })}
      label="A"
      globalIndex={0}
      total={1}
      grouped={false}
      canGroupWithPrevious={false}
      onDragStart={() => {}}
      onDragOver={() => {}}
      onDrop={() => {}}
      onDragEnd={() => {}}
    />,
  );
}

describe('TemplateExerciseRow', () => {
  it('starts collapsed with a summary of the targets and opens the fields on tap', async () => {
    const user = userEvent.setup();
    renderRow();

    expect(screen.getByText('3 Sätze · 8–12 Wdh. · Pause 120 s')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Sätze' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByRole('textbox', { name: 'Sätze' })).toBeInTheDocument();
    // Expanded, the fields carry the values, so the summary is not repeated.
    expect(
      screen.queryByText('3 Sätze · 8–12 Wdh. · Pause 120 s'),
    ).not.toBeInTheDocument();
  });

  it('keeps reordering and removing reachable while collapsed', () => {
    renderRow();
    expect(
      screen.getByRole('button', { name: /Bankdrücken.*entfernen/ }),
    ).toBeInTheDocument();
  });

  it('summarises in English too', () => {
    setLanguage('en');
    renderRow();
    expect(screen.getByText('3 sets · 8–12 reps · Rest 120 s')).toBeInTheDocument();
  });
});
