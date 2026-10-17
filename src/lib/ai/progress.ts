import { create } from 'zustand';

/**
 * How far an AI answer has got, for the "45 %" next to each stage. The model first thinks (no
 * text yet), then writes; the percentage is the characters written so far against the size of
 * this kind of answer last time (or a typical size), capped at 97 % until the answer is complete.
 */
export interface AiProgress { chars: number; startedAt: number; done: boolean }

interface ProgressStore {
  byKey: Record<string, AiProgress>;
  set: (key: string, p: AiProgress) => void;
}

export const useAiProgressStore = create<ProgressStore>()((set) => ({
  byKey: {},
  set: (key, p) => set((s) => ({ byKey: { ...s.byKey, [key]: p } })),
}));

// Typical answer sizes (characters of JSON) when there is no earlier run in this browser.
const TYPICAL: Record<string, number> = {
  spec: 6000, equipment: 4000, io: 7000, electrical: 30000, hmi: 26000, 'hmi-recreate': 6000,
  program: 22000, 'program-revise': 22000, review: 9000, import: 12000,
};
const SIZE_KEY = (k: string) => `isa-ai-size:${k}`;

function expected(key: string): number {
  try {
    const v = Number(localStorage.getItem(SIZE_KEY(key)));
    if (v > 500) return v;
  } catch { /* storage blocked */ }
  return TYPICAL[key] ?? 15000;
}

const keys = new WeakMap<AbortSignal, string>();

/** Report progress of requests made with this signal under `key` (a stage or job kind). */
export function bindProgress(signal: AbortSignal, key: string): void {
  keys.set(signal, key);
  useAiProgressStore.getState().set(key, { chars: 0, startedAt: Date.now(), done: false });
}

/** Called by the AI layer while an answer streams. */
export function reportAiProgress(signal: AbortSignal | undefined, chars: number): void {
  const key = signal ? keys.get(signal) : undefined;
  if (!key) return;
  const cur = useAiProgressStore.getState().byKey[key];
  if (cur && chars > cur.chars) useAiProgressStore.getState().set(key, { ...cur, chars });
}

/** The request under `key` finished: remember the answer size for the next estimate. */
export function finishProgress(key: string, ok: boolean): void {
  const cur = useAiProgressStore.getState().byKey[key];
  if (!cur) return;
  if (ok && cur.chars > 500) { try { localStorage.setItem(SIZE_KEY(key), String(cur.chars)); } catch { /* storage blocked */ } }
  useAiProgressStore.getState().set(key, { ...cur, done: true });
}

/** Percent (0–97) while writing, or null while the model is still thinking. */
export function percentOf(key: string, p: AiProgress | undefined): number | null {
  if (!p || p.chars === 0) return null;
  return Math.min(97, Math.max(1, Math.round((p.chars / expected(key)) * 100)));
}

export function useAiProgress(key: string): AiProgress | undefined {
  return useAiProgressStore((s) => s.byKey[key]);
}
