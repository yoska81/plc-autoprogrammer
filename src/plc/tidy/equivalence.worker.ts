/// <reference lib="webworker" />
import { checkEquivalence, type EquivalenceOptions } from './equivalence';
import type { LadderProgram } from '../core/ladder';

// One check per worker: progress as it runs, then the result (or the error's message). Cancel ends the worker.
self.onmessage = (e: MessageEvent<{ original: LadderProgram; reorganized: LadderProgram; options: EquivalenceOptions }>) => {
  const { original, reorganized, options } = e.data;
  try {
    const result = checkEquivalence(original, reorganized, { ...options, onProgress: (done, total) => self.postMessage({ progress: { done, total } }) });
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
