import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '@/hooks/useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Renders the hook with a mock save and a mutable value. */
function setup(initial = { weight: '' }, options?: Parameters<typeof useAutosave>[2]) {
  const save = vi.fn();
  const view = renderHook(({ value }) => useAutosave(value, save, options), {
    initialProps: { value: initial },
  });
  return { save, view };
}

describe('debounced writing', () => {
  it('does not write while the value is still changing', () => {
    const { save, view } = setup();

    view.rerender({ value: { weight: '8' } });
    act(() => void vi.advanceTimersByTime(200));
    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(200));

    // 400 ms have passed, but never 400 ms of quiet.
    expect(save).not.toHaveBeenCalled();
  });

  it('writes once the value stops changing', () => {
    const { save, view } = setup();

    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(400));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ weight: '80' });
  });

  it('writes only the latest value after rapid edits', () => {
    const { save, view } = setup();

    for (const weight of ['8', '80', '82', '82.5']) {
      view.rerender({ value: { weight } });
      act(() => void vi.advanceTimersByTime(100));
    }
    act(() => void vi.advanceTimersByTime(400));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ weight: '82.5' });
  });

  it('never writes unchanged data', () => {
    const { save, view } = setup({ weight: '80' });

    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(1000));

    expect(save).not.toHaveBeenCalled();
  });

  it('does not write the same value twice in a row', () => {
    const { save, view } = setup();

    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(400));
    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(400));

    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('flushing before the app disappears', () => {
  it('writes immediately when the page is hidden', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // No timer had to elapse — switching apps must not lose the value.
    expect(save).toHaveBeenCalledWith({ weight: '80' });
  });

  it('ignores becoming visible again', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('writes on pagehide, the event iOS Safari actually fires', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => void window.dispatchEvent(new Event('pagehide')));

    expect(save).toHaveBeenCalledWith({ weight: '80' });
  });

  it('writes pending changes on unmount', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => view.unmount());

    expect(save).toHaveBeenCalledWith({ weight: '80' });
  });

  it('writes nothing on unmount when there is nothing pending', () => {
    const { save, view } = setup({ weight: '80' });

    act(() => view.unmount());

    expect(save).not.toHaveBeenCalled();
  });
});

describe('manual control', () => {
  it('flush() writes right away', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => view.result.current.flush());

    expect(save).toHaveBeenCalledTimes(1);
    // The scheduled timer must not fire a second write.
    act(() => void vi.advanceTimersByTime(1000));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops a pending write', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => view.result.current.cancel());
    act(() => void vi.advanceTimersByTime(1000));

    expect(save).not.toHaveBeenCalled();
  });

  it('markSaved() adopts the value without writing it', () => {
    const { save, view } = setup();
    view.rerender({ value: { weight: '80' } });

    act(() => view.result.current.markSaved());
    act(() => void vi.advanceTimersByTime(1000));

    expect(save).not.toHaveBeenCalled();
  });
});

describe('disabling', () => {
  it('never writes while disabled', () => {
    const save = vi.fn();
    const view = renderHook(({ value }) => useAutosave(value, save, { enabled: false }), {
      initialProps: { value: { weight: '' } },
    });

    view.rerender({ value: { weight: '80' } });
    act(() => void vi.advanceTimersByTime(1000));
    act(() => void window.dispatchEvent(new Event('pagehide')));

    expect(save).not.toHaveBeenCalled();
  });

  it('drops an in-flight write when it becomes disabled', () => {
    const save = vi.fn();
    const view = renderHook(
      ({ value, enabled }) => useAutosave(value, save, { enabled }),
      { initialProps: { value: { weight: '' }, enabled: true } },
    );

    // This is the completion race: a set is finished while a write is pending.
    view.rerender({ value: { weight: '80' }, enabled: true });
    act(() => void vi.advanceTimersByTime(100));
    view.rerender({ value: { weight: '80' }, enabled: false });
    act(() => void vi.advanceTimersByTime(1000));

    // A completed set must not be overwritten by the stale draft.
    expect(save).not.toHaveBeenCalled();
  });

  it('does not flush on unmount once disabled', () => {
    const save = vi.fn();
    const view = renderHook(
      ({ value, enabled }) => useAutosave(value, save, { enabled }),
      { initialProps: { value: { weight: '' }, enabled: true } },
    );

    view.rerender({ value: { weight: '80' }, enabled: false });
    act(() => view.unmount());

    expect(save).not.toHaveBeenCalled();
  });
});
