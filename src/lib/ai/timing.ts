import { create } from 'zustand';

/**
 * Timing of every AI request (task, model, effort, sizes, how long, cache hit) — the log behind the
 * Update dialog's "this run took X s (AI Y s)" line and tools/bench-update.ts. Also printed to the
 * console as one line per request.
 */
export interface AiCall {
  task: string;
  model: string;
  effort: string;
  startedAt: number;
  endedAt: number;
  /** Characters sent (system prompt + turns + schema). */
  promptChars: number;
  /** Characters of the answer. */
  outChars: number;
  /** Answered from the cache (no request made). */
  cached: 'memory' | 'stored' | 'shared' | null;
  ok: boolean;
  /** Prompt-cache tokens the API reported (all turns of the request): read from the cache, written to it. */
  cacheRead?: number;
  cacheWrite?: number;
}

const MAX_LOG = 300;
let clock: () => number = () => Date.now();
/** Test hook (bench): a simulated clock. */
export function setAiClock(fn: (() => number) | null) { clock = fn ?? (() => Date.now()); }
export const aiNow = () => clock();

export const useAiTimingStore = create<{ calls: AiCall[] }>(() => ({ calls: [] }));

let quiet = false;
/** Test hook: no console line per request. */
export function setAiTimingQuiet(q: boolean) { quiet = q; }

export function logAiCall(c: AiCall): void {
  useAiTimingStore.setState((s) => ({ calls: [...s.calls.slice(-(MAX_LOG - 1)), c] }));
  if (!quiet) console.info(`[ai] ${c.task} ${c.model}/${c.effort} ${((c.endedAt - c.startedAt) / 1000).toFixed(1)} s · in ${c.promptChars} ch · out ${c.outChars} ch${c.cached ? ` · cache (${c.cached})` : ''}${c.cacheRead || c.cacheWrite ? ` · prompt cache read ${c.cacheRead ?? 0} / written ${c.cacheWrite ?? 0} tokens` : ''}${c.ok ? '' : ' · failed'}`);
}

/** AI requests that ran (at least partly) between `from` and `to`. */
export function callsBetween(from: number, to: number): AiCall[] {
  return useAiTimingStore.getState().calls.filter((c) => c.endedAt >= from && c.startedAt <= to);
}

/** Wall-clock time with at least one AI request running (overlapping requests count once). */
export function aiBusyMs(calls: AiCall[], from = -Infinity, to = Infinity): number {
  const spans = calls.filter((c) => !c.cached).map((c) => [Math.max(from, c.startedAt), Math.min(to, c.endedAt)] as const).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let total = 0, end = -Infinity;
  for (const [a, b] of spans) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total;
}

/** "42 s" / "2 min 05 s". */
export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (ms < 1000) return `${(ms / 1000).toFixed(1)} s`;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
