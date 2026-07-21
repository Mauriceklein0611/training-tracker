import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  getSessionDetail,
  startFreeSession,
} from '@/db/repositories/sessions';
import { ToastProvider } from '@/components/ui/ToastProvider';
import LiveSessionPage from '@/pages/LiveSessionPage';
import { resetDatabase } from '@/tests/dbTestUtils';

/**
 * Integration test for the live view — the screen used while training.
 *
 * Drives the real components against a real (in-memory) IndexedDB, so it
 * covers the whole chain: entering a set, persisting it, starting the rest from
 * an absolute timestamp and ending it again.
 */

function renderLiveSession(sessionId: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/training/${sessionId}`]}>
        <Routes>
          <Route path="/training/:sessionId" element={<LiveSessionPage />} />
          <Route path="/verlauf/:sessionId" element={<p>Verlaufsdetail</p>} />
          <Route path="/" element={<p>Startseite</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

async function seedSession() {
  const exercise = await createExercise({
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
  const session = await startFreeSession('Testtraining');
  await addExerciseToSession(session.id, exercise);
  return session;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('live workout view', () => {
  it('shows the running workout with its exercise', async () => {
    const session = await seedSession();
    renderLiveSession(session.id);

    expect(await screen.findByRole('heading', { name: /Testtraining/ })).toBeInTheDocument();
    // The exercise name also appears in icon-button labels, so target the heading.
    expect(
      await screen.findByRole('heading', { name: /Bankdrücken/, level: 2 }),
    ).toBeInTheDocument();
  });

  it('records a set and starts the rest from an absolute timestamp', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /Ersten Satz erfassen/ }));

    const weight = await screen.findByLabelText(/Gewicht gesamt/);
    const reps = await screen.findByLabelText(/^Wiederholungen$/);
    await user.type(weight, '80');
    await user.type(reps, '8');

    await user.click(screen.getByRole('button', { name: /Satz abschließen/ }));

    // The set reached the database with the entered values …
    await waitFor(async () => {
      const detail = await getSessionDetail(session.id);
      const completed = detail?.exercises[0].sets.filter((set) => set.completedAt) ?? [];
      expect(completed).toHaveLength(1);
      expect(completed[0].weightKg).toBe(80);
      expect(completed[0].reps).toBe(8);
      // … and the rest was anchored to a real timestamp, not a counter.
      expect(completed[0].restStartedAt).toBeTruthy();
      expect(Number.isNaN(Date.parse(completed[0].restStartedAt!))).toBe(false);
    });

    // The rest bar appears with the target time.
    expect(await screen.findByText(/Pause läuft/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause beenden/ })).toBeInTheDocument();
  });

  it('stores the actual rest duration when the rest is ended', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /Ersten Satz erfassen/ }));
    await user.type(await screen.findByLabelText(/Gewicht gesamt/), '60');
    await user.type(await screen.findByLabelText(/^Wiederholungen$/), '10');
    await user.click(screen.getByRole('button', { name: /Satz abschließen/ }));

    await user.click(await screen.findByRole('button', { name: /Pause beenden/ }));

    await waitFor(async () => {
      const detail = await getSessionDetail(session.id);
      const completed = detail!.exercises[0].sets.find((set) => set.completedAt)!;
      expect(completed.restEndedAt).toBeTruthy();
      expect(completed.restActualSeconds).toBeGreaterThanOrEqual(0);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Pause läuft/)).not.toBeInTheDocument();
    });
  });

  it('refuses to complete a set with invalid input', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /Ersten Satz erfassen/ }));
    // Weight entered, repetitions left empty.
    await user.type(await screen.findByLabelText(/Gewicht gesamt/), '80');
    await user.click(screen.getByRole('button', { name: /Satz abschließen/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Wiederholungen fehlen/);

    const detail = await getSessionDetail(session.id);
    expect(detail?.exercises[0].sets.filter((set) => set.completedAt)).toHaveLength(0);
  });

  it('asks for confirmation before finishing and then completes the workout', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /Ersten Satz erfassen/ }));
    await user.type(await screen.findByLabelText(/Gewicht gesamt/), '60');
    await user.type(await screen.findByLabelText(/^Wiederholungen$/), '10');
    await user.click(screen.getByRole('button', { name: /Satz abschließen/ }));

    await user.click(await screen.findByRole('button', { name: /^Beenden$/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Training beenden\?/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Training abschließen/ }));

    await waitFor(async () => {
      expect((await db.workoutSessions.get(session.id))?.status).toBe('completed');
    });
  });

  it('keeps the workout when the finish dialog is dismissed', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /^Beenden$/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Weiter trainieren/ }));

    expect((await db.workoutSessions.get(session.id))?.status).toBe('active');
  });

  it('explains that discarding is destructive when sets exist', async () => {
    const user = userEvent.setup();
    const session = await seedSession();
    renderLiveSession(session.id);

    await user.click(await screen.findByRole('button', { name: /Ersten Satz erfassen/ }));
    await user.type(await screen.findByLabelText(/Gewicht gesamt/), '60');
    await user.type(await screen.findByLabelText(/^Wiederholungen$/), '10');
    await user.click(screen.getByRole('button', { name: /Satz abschließen/ }));

    await user.click(await screen.findByRole('button', { name: /Training verwerfen/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/endgültig gelöscht/)).toBeInTheDocument();
    // The workout still exists until the destructive action is confirmed.
    expect((await db.workoutSessions.get(session.id))?.status).toBe('active');
  });
});
