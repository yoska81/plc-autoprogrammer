/**
 * AI request failures sorted into what the user can do about them, and the retry policy for the
 * transient ones (network drop, overloaded service, timeout). Shared by the API-key path
 * (Anthropic / OpenAI from the browser) and the preview's Claude-account path.
 */

export type AiErrorKind = 'network' | 'overloaded' | 'timeout' | 'auth' | 'limit' | 'cancelled' | 'other';

export interface AiErrorInfo {
  kind: AiErrorKind;
  /** Worth retrying automatically. */
  transient: boolean;
  /** Server-suggested wait (Retry-After), ms. */
  retryAfterMs?: number;
  status?: number;
}

const header = (err: unknown, name: string): string | undefined => {
  const h = (err as { headers?: Headers | Record<string, string> } | null)?.headers;
  if (!h) return undefined;
  if (typeof (h as Headers).get === 'function') return (h as Headers).get(name) ?? undefined;
  return (h as Record<string, string>)[name];
};

/** Sort any thrown value from an AI request. */
export function classifyAiError(err: unknown, signal?: AbortSignal): AiErrorInfo {
  if (signal?.aborted) return { kind: 'cancelled', transient: false };
  const e = err as { name?: string; status?: number; code?: string; message?: string; cause?: unknown } | null;
  const name = e?.name ?? '';
  const msg = `${e?.message ?? ''}`;
  if (name === 'APIUserAbortError' || name === 'AbortError' || e?.code === 'cancelled') return { kind: 'cancelled', transient: false };
  // preview (claude.ai account) error codes
  if (e?.code === 'rate_limited') return { kind: 'overloaded', transient: true };
  if (e?.code === 'session_expired' || e?.code === 'not_granted') return { kind: 'auth', transient: false };
  const status = typeof e?.status === 'number' ? e.status : undefined;
  if (name === 'APIConnectionTimeoutError' || /timed? ?out|timeout/i.test(msg)) return { kind: 'timeout', transient: true, status };
  if (status === 401 || status === 403) return { kind: 'auth', transient: false, status };
  if (/credit balance|billing/i.test(msg)) return { kind: 'limit', transient: false, status };
  const ra = Number(header(err, 'retry-after'));
  const retryAfterMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60_000) : undefined;
  if (status === 429 || status === 529 || /overloaded/i.test(msg)) return { kind: 'overloaded', transient: true, retryAfterMs, status };
  if (status !== undefined && status >= 500) return { kind: 'overloaded', transient: true, retryAfterMs, status };
  if (status === 408 || status === 409) return { kind: 'timeout', transient: true, status };
  if (name === 'APIConnectionError' || (name === 'TypeError' && /fetch|network|load failed/i.test(msg))
    || /network|connection|socket|terminated|stream (ended|closed)|ECONNRESET|ERR_NETWORK|premature/i.test(msg)) return { kind: 'network', transient: true, status };
  if (e?.cause && e.cause !== err) {
    const inner = classifyAiError(e.cause, signal);
    if (inner.kind !== 'other') return inner;
  }
  return { kind: 'other', transient: false, status };
}

/** Plain-English prefix for the final failure of each kind. */
export const KIND_TEXT: Record<AiErrorKind, string> = {
  network: 'The connection to the AI service dropped',
  overloaded: 'The AI service is busy',
  timeout: 'The AI service did not answer in time',
  auth: 'The AI service did not accept the key or account',
  limit: 'The AI account has reached a limit',
  cancelled: 'Stopped',
  other: 'The AI request failed',
};

/** Automatic retries after the first attempt, and the wait before each (ms). */
export const RETRY_DELAYS = [2_000, 6_000, 15_000];

export interface RetryNotice { attempt: number; max: number; kind: AiErrorKind; waitMs: number }

/** Wait ms, or reject when the signal aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run one AI request with automatic retries on transient failures. `explain` turns the final
 * error into the user's message; `onRetry` reports "retrying (n/3)".
 */
export async function withRetries<T>(
  attempt: () => Promise<T>,
  o: { signal?: AbortSignal; onRetry?: (n: RetryNotice) => void; explain: (err: unknown, info: AiErrorInfo) => string; delays?: number[] },
): Promise<T> {
  const delays = o.delays ?? RETRY_DELAYS;
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      const info = classifyAiError(err, o.signal);
      if (info.kind === 'cancelled') throw new AiRequestError('Stopped.', info, err);
      if (!info.transient || i >= delays.length) {
        const tries = i + 1;
        throw new AiRequestError(`${o.explain(err, info)}${info.transient && tries > 1 ? ` (tried ${tries} times)` : ''}`, info, err);
      }
      const waitMs = Math.max(delays[i], info.retryAfterMs ?? 0);
      o.onRetry?.({ attempt: i + 1, max: delays.length, kind: info.kind, waitMs });
      await sleep(waitMs, o.signal).catch((e) => { throw new AiRequestError('Stopped.', { kind: 'cancelled', transient: false }, e); });
    }
  }
}

/** The final error of an AI request, with its classification. */
export class AiRequestError extends Error {
  readonly info: AiErrorInfo;
  constructor(message: string, info: AiErrorInfo, cause?: unknown) {
    super(message, { cause });
    this.name = 'AiRequestError';
    this.info = info;
  }
}
