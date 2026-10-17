import { create } from 'zustand';

/**
 * How far an AI answer has got, for the "45 %" next to each stage. The model first thinks (no
 * text yet), then writes; the percentage is the characters written so far against the size of
 * this kind of answer last time (or a typical size), capped at 97 % until the answer is complete.
 */
export interface AiProgress { chars: number; startedAt: number; done: boolean; /** When the first answer text arrived (end of thinking). */ textAt?: number }

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
const THINK_KEY = (k: string) => `isa-ai-think:${k}`;
// Typical thinking time before the answer starts (ms) when there is no earlier run in this browser.
const TYPICAL_THINK = 90_000;

function expectedThink(key: string): number {
  try {
    const v = Number(localStorage.getItem(THINK_KEY(key)));
    if (v > 2000) return v;
  } catch { /* storage blocked */ }
  return TYPICAL_THINK;
}

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
  if (cur && chars > cur.chars) useAiProgressStore.getState().set(key, { ...cur, chars, textAt: cur.textAt ?? Date.now() });
}

/** The request under `key` finished: remember the answer size for the next estimate. */
export function finishProgress(key: string, ok: boolean): void {
  const cur = useAiProgressStore.getState().byKey[key];
  if (!cur) return;
  if (ok && cur.chars > 500) { try { localStorage.setItem(SIZE_KEY(key), String(cur.chars)); } catch { /* storage blocked */ } }
  if (ok && cur.textAt) { try { localStorage.setItem(THINK_KEY(key), String(cur.textAt - cur.startedAt)); } catch { /* storage blocked */ } }
  useAiProgressStore.getState().set(key, { ...cur, done: true });
}

/**
 * Estimated percent complete (1–99) of an AI stage: thinking counts for the first 50 %
 * (elapsed time against how long this stage thought last time, or a typical time), writing
 * for the rest (characters written against the last answer's size). Null when nothing runs.
 */
export function percentOf(key: string, p: AiProgress | undefined, now = Date.now()): number | null {
  if (!p || p.done) return null;
  if (!p.chars) {
    const t = (now - p.startedAt) / expectedThink(key);
    // rises quickly at first and approaches (never reaches) 50 % while still thinking
    return Math.max(1, Math.round(49 * (1 - Math.exp(-2 * t))));
  }
  return Math.min(99, Math.max(50, Math.round(50 + (p.chars / expected(key)) * 50)));
}

/** True while the model is still thinking (no answer text yet). */
export const isThinking = (p: AiProgress | undefined) => Boolean(p && !p.done && !p.chars);

export function useAiProgress(key: string): AiProgress | undefined {
  return useAiProgressStore((s) => s.byKey[key]);
}
