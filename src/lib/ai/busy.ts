/**
 * Counts AI requests in flight. The stores always hold the open project, so an
 * answer that arrives after another project was opened would be written into
 * the wrong project: switching projects waits until this is zero.
 */
let inFlight = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const aiBusy = () => inFlight > 0;

export function onAiBusyChange(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export async function trackAi<T>(run: () => Promise<T>): Promise<T> {
  inFlight++;
  notify();
  try {
    return await run();
  } finally {
    inFlight--;
    notify();
  }
}
