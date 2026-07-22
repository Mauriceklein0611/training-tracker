/**
 * Rest timer feedback.
 *
 * The alert tone is synthesised with the Web Audio API instead of shipping an
 * audio file — it keeps the bundle small and avoids any external asset.
 * Both sound and vibration degrade silently when unsupported.
 */

let audioContext: AudioContext | null = null;

type AudioContextConstructor = new () => AudioContext;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext ??= new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * iOS only allows audio after a user gesture. Calling this from a tap (e.g.
 * when a set is completed) unlocks the context for the later timer beep.
 */
export function primeAudio(): void {
  const context = getAudioContext();
  if (context && context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
}

/** Two short beeps, played when the target rest time is reached. */
export function playRestFinishedSound(): void {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const start = context.currentTime;

    for (const [index, frequency] of [880, 1174.66].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      const offset = start + index * 0.22;
      // Short attack/decay envelope avoids an audible click.
      gain.gain.setValueAtTime(0.0001, offset);
      gain.gain.exponentialRampToValueAtTime(0.25, offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, offset + 0.18);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(offset);
      oscillator.stop(offset + 0.2);
    }
  } catch {
    // Audio is optional — never let it break the workout.
  }
}

export function vibrate(pattern: number | number[] = [120, 60, 120]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Not supported (all iOS browsers) — ignore.
  }
}
