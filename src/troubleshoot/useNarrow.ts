import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 640px)';
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null);

/** True on a phone-sized screen: the fault-finding views then take the whole screen. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (fn) => { const m = mq(); m?.addEventListener('change', fn); return () => m?.removeEventListener('change', fn); },
    () => mq()?.matches ?? false,
    () => false,
  );
}
