import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTimerState,
  createTimerState,
  elapsedSeconds,
  isCountdownFinished,
  isRunning,
  loadTimerState,
  MAX_TIMER_AGE_MS,
  pause,
  remainingSeconds,
  reset,
  saveTimerState,
  setCountdown,
  start,
} from '@/services/exerciseTimer';

const T0 = 1_800_000_000_000; // fixed epoch for readable arithmetic

beforeEach(() => {
  clearTimerState();
});

describe('elapsed time from absolute timestamps', () => {
  it('counts nothing before the timer is started', () => {
    const state = createTimerState('set-1', null, T0);
    expect(isRunning(state)).toBe(false);
    expect(elapsedSeconds(state, T0 + 60_000)).toBe(0);
  });

  it('derives the elapsed time from the start timestamp', () => {
    const state = start(createTimerState('set-1', null, T0), T0);
    expect(elapsedSeconds(state, T0 + 45_000)).toBe(45);
  });

  it('stays exact across a long interruption', () => {
    // Phone locked for ten minutes: nothing ticked, yet the time is right.
    const state = start(createTimerState('set-1', null, T0), T0);
    expect(elapsedSeconds(state, T0 + 600_000)).toBe(600);
  });

  it('banks the elapsed time when paused', () => {
    let state = start(createTimerState('set-1', null, T0), T0);
    state = pause(state, T0 + 30_000);

    expect(isRunning(state)).toBe(false);
    // Frozen: later clock readings must not advance it.
    expect(elapsedSeconds(state, T0 + 90_000)).toBe(30);
  });

  it('continues from the banked time when resumed', () => {
    let state = start(createTimerState('set-1', null, T0), T0);
    state = pause(state, T0 + 30_000);
    state = start(state, T0 + 100_000);

    expect(elapsedSeconds(state, T0 + 120_000)).toBe(50); // 30 banked + 20 running
  });

  it('survives several pause/resume cycles', () => {
    let state = createTimerState('set-1', null, T0);
    state = start(state, T0);
    state = pause(state, T0 + 10_000);
    state = start(state, T0 + 20_000);
    state = pause(state, T0 + 25_000);
    state = start(state, T0 + 60_000);

    expect(elapsedSeconds(state, T0 + 65_000)).toBe(20); // 10 + 5 + 5
  });

  it('resets back to zero', () => {
    let state = start(createTimerState('set-1', null, T0), T0);
    state = reset(state, T0 + 30_000);

    expect(elapsedSeconds(state, T0 + 60_000)).toBe(0);
    expect(isRunning(state)).toBe(false);
  });

  it('never reports a negative time if the clock jumps backwards', () => {
    const state = start(createTimerState('set-1', null, T0), T0);
    expect(elapsedSeconds(state, T0 - 60_000)).toBe(0);
  });

  it('is idempotent for repeated start and pause', () => {
    const running = start(start(createTimerState('set-1', null, T0), T0), T0 + 10_000);
    // The second start must not restart the measurement.
    expect(elapsedSeconds(running, T0 + 20_000)).toBe(20);

    const paused = pause(pause(running, T0 + 20_000), T0 + 50_000);
    expect(elapsedSeconds(paused, T0 + 90_000)).toBe(20);
  });
});

describe('countdown mode', () => {
  it('reports the remaining time', () => {
    const state = start(createTimerState('set-1', 60, T0), T0);
    expect(remainingSeconds(state, T0 + 20_000)).toBe(40);
    expect(isCountdownFinished(state, T0 + 20_000)).toBe(false);
  });

  it('finishes at zero and never goes negative', () => {
    const state = start(createTimerState('set-1', 60, T0), T0);

    expect(remainingSeconds(state, T0 + 60_000)).toBe(0);
    expect(isCountdownFinished(state, T0 + 60_000)).toBe(true);
    expect(remainingSeconds(state, T0 + 120_000)).toBe(0);
    // The stopwatch keeps counting past the target.
    expect(elapsedSeconds(state, T0 + 120_000)).toBe(120);
  });

  it('has no remaining time in stopwatch mode', () => {
    const state = start(createTimerState('set-1', null, T0), T0);
    expect(remainingSeconds(state, T0 + 30_000)).toBeNull();
    expect(isCountdownFinished(state, T0 + 30_000)).toBe(false);
  });

  it('can switch between countdown and stopwatch', () => {
    let state = setCountdown(createTimerState('set-1', 60, T0), null, T0);
    expect(remainingSeconds(state, T0)).toBeNull();

    state = setCountdown(state, 90, T0);
    expect(remainingSeconds(state, T0)).toBe(90);
  });
});

describe('persistence', () => {
  it('restores a running timer for the same set', () => {
    const state = start(createTimerState('set-1', 60, T0), T0);
    saveTimerState(state);

    const restored = loadTimerState('set-1', T0 + 30_000);
    expect(restored).not.toBeNull();
    // A reload must not lose the measurement.
    expect(elapsedSeconds(restored!, T0 + 30_000)).toBe(30);
  });

  it('ignores state belonging to a different set', () => {
    saveTimerState(start(createTimerState('set-1', null, T0), T0));
    expect(loadTimerState('set-2', T0 + 1000)).toBeNull();
  });

  it('discards state that is too old to still be running', () => {
    saveTimerState(start(createTimerState('set-1', null, T0), T0));
    expect(loadTimerState('set-1', T0 + MAX_TIMER_AGE_MS + 1)).toBeNull();
  });

  it('keeps state that is still within the age limit', () => {
    saveTimerState(start(createTimerState('set-1', null, T0), T0));
    expect(loadTimerState('set-1', T0 + MAX_TIMER_AGE_MS - 1000)).not.toBeNull();
  });

  it('discards malformed state instead of crashing', () => {
    localStorage.setItem('training-tracker.exercise-timer', '{not json');
    expect(loadTimerState('set-1', T0)).toBeNull();

    localStorage.setItem('training-tracker.exercise-timer', '{"setId":"set-1"}');
    expect(loadTimerState('set-1', T0)).toBeNull();
  });

  it('returns null when nothing was stored', () => {
    expect(loadTimerState('set-1', T0)).toBeNull();
  });

  it('clears the stored state', () => {
    saveTimerState(start(createTimerState('set-1', null, T0), T0));
    clearTimerState();
    expect(loadTimerState('set-1', T0)).toBeNull();
  });
});
