import type Anthropic from '@anthropic-ai/sdk';
import { callClaude, type ClaudeOptions, type ClaudeResult } from './anthropic';
import type { AiTask } from './tasks';
import { linkProgress } from './progress';

/**
 * Several requests over the same large input (e.g. every drawing file), each asking for one part of
 * the answer, written in parallel: the shared prefix (system prompt + `prefix` blocks) is prompt-cached
 * with cache_control on its last block, so the parts after the first read it from the cache. The first
 * part starts alone; the others start as soon as its answer begins (the cache entry exists by then) or
 * it fails. Each part is its own request, so the answer cache keys each part separately. The parts'
 * answers come back in the order given; any part failing fails the whole (Cancel stops them all).
 */
export interface CachedPart {
  /** What this part asks for (a text block after the shared prefix). */
  instruction: string;
  /** JSON schema of this part's answer. */
  schema?: Record<string, unknown>;
  /** Sets its effort (Speed fast) and names it in the timing log; default: the base's task. */
  task?: AiTask;
}

export type PartState = 'waiting' | 'started' | 'done' | 'failed';

export async function parallelCached(
  base: Omit<ClaudeOptions, 'messages' | 'schema' | 'onStarted'> & { prefix: Anthropic.Beta.Messages.BetaContentBlockParam[] },
  parts: CachedPart[],
  onPart?: (index: number, state: PartState) => void,
): Promise<ClaudeResult[]> {
  const { prefix, ...opts } = base;
  // one part failing stops the others (their answers would be thrown away); Cancel stops them all
  const ctrl = new AbortController();
  if (opts.signal?.aborted) ctrl.abort(); else opts.signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  // the cache breakpoint on the last shared block (everything before it is cached with it)
  const shared = prefix.map((b, i) => (i === prefix.length - 1 ? { ...b, cache_control: { type: 'ephemeral' as const } } : b)) as Anthropic.Beta.Messages.BetaContentBlockParam[];
  let warm!: () => void;
  const firstStarted = new Promise<void>((resolve) => { warm = resolve; });
  const run = (part: CachedPart, i: number, onStarted?: () => void): Promise<ClaudeResult> => {
    onPart?.(i, 'waiting');
    // its own signal (stopped with the others), whose streamed characters add to the caller's progress
    const own = new AbortController();
    if (ctrl.signal.aborted) own.abort(); else ctrl.signal.addEventListener('abort', () => own.abort(), { once: true });
    linkProgress(own.signal, opts.signal);
    let started = false; // once, also when a retried request starts again
    return callClaude({
      ...opts,
      signal: own.signal,
      task: part.task ?? opts.task,
      schema: part.schema,
      messages: [{ role: 'user', content: [...shared, { type: 'text', text: part.instruction }] }],
      onStarted: () => { if (started) return; started = true; onPart?.(i, 'started'); onStarted?.(); },
    }).then((r) => { onPart?.(i, 'done'); return r; }, (err: unknown) => { onPart?.(i, 'failed'); ctrl.abort(); throw err; });
  };
  if (!parts.length) return [];
  const first = run(parts[0], 0, warm);
  // the first part ending without a start signal (failed, or answered by a path that sends none) releases the others too
  first.then(warm, warm);
  const rest = parts.slice(1).map((p, k) => firstStarted.then(() => run(p, k + 1)));
  return Promise.all([first, ...rest]);
}
