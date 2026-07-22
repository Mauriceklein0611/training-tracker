/**
 * Local, offline text-to-speech via the browser's SpeechSynthesis API.
 *
 * A pure progressive enhancement: everything is wrapped so that a browser
 * without support (or one that blocks speech outside a user gesture) simply
 * stays silent and never breaks the workout flow. Nothing is ever sent
 * anywhere — the synthesis happens entirely on the device.
 */

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/** Speaks a short phrase, replacing anything currently being spoken. */
export function speak(text: string, lang = 'de-DE'): void {
  if (!isSpeechSupported() || !text.trim()) return;
  try {
    const synth = window.speechSynthesis;
    // Cancel any pending utterance so announcements never pile up.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    synth.speak(utterance);
  } catch {
    // Ignore — speech is optional and must never interrupt training.
  }
}

export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore.
  }
}
