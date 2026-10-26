/**
 * Where voice input can work, and what to tell the user when the microphone is refused. Pure
 * (no browser APIs), unit-tested in micAccess.test.ts.
 *  - preview: the claude.ai side-panel frame has no microphone at all (no prompt is ever shown);
 *  - desktop: the Windows app asks with its own dialog (electron/micPermission.cjs);
 *  - browser: the browser's own prompt.
 */
export type MicPlace = 'preview' | 'desktop' | 'browser';

export function micPlace(o: { preview: boolean; desktop: boolean }): MicPlace {
  return o.preview ? 'preview' : o.desktop ? 'desktop' : 'browser';
}

export const PREVIEW_NO_MIC = 'Voice input works in the Windows app; the browser preview cannot use the microphone. Reading aloud works here.';

/** Can a microphone button start listening here? */
export function micUsable(place: MicPlace): boolean {
  return place !== 'preview';
}

/** Plain words for an error that stopped voice input. */
export function micErrorText(e: unknown, place: MicPlace): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (place === 'preview') return PREVIEW_NO_MIC;
  // A refusal from a real prompt (NotAllowedError), or the browser recognition's "not-allowed".
  if (name === 'NotAllowedError' || name === 'SecurityError' || /^(not-allowed|service-not-allowed)$/.test(msg) || /Permission denied/i.test(msg)) {
    return place === 'desktop'
      ? 'The microphone was not allowed. Press the microphone again and choose "Allow once" or "Always allow". If no question appears, allow desktop apps to use the microphone in Windows Settings → Privacy & security → Microphone.'
      : 'The microphone was not allowed for this page. To use voice input, allow the microphone with the camera/microphone icon in the address bar, then press the microphone again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || /audio-capture|Requested device not found/i.test(msg)) return 'No microphone was found. Plug one in (or turn it on) and try again.';
  if (name === 'NotReadableError') return 'The microphone is in use by another program or turned off in Windows. Close the other program (or turn the microphone on) and try again.';
  return msg || 'Voice input stopped unexpectedly.';
}

/** What Settings → Voice says about the desktop permission. */
export function micPermissionText(p: 'always' | 'session' | 'ask'): string {
  return p === 'always' ? 'Microphone: allowed always' : p === 'session' ? 'Microphone: allowed until the app is closed' : 'Microphone: the app asks the first time you press a microphone button';
}
