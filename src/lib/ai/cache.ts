/**
 * Answer cache: the same request (model, effort, system prompt, turns, schema) is answered at once
 * from memory, or from IndexedDB after a reload, so re-running Update with unchanged inputs makes no
 * AI calls. A request already on its way is shared too: a stage that asks what a prefetch already
 * asked waits for that answer instead of asking again. Failures are never stored.
 */

export interface CachedAnswer { text: string; reasoning: string | null }
export interface CacheKeyParts { model: string; effort: string; system: string; messages: unknown; schema?: unknown }

const MAX_ENTRIES = 400;
const DB_NAME = 'isa-ai-cache';
const STORE = 'answers';

const memory = new Map<string, CachedAnswer>();
const inflight = new Map<string, Promise<CachedAnswer>>();
let enabled = true;

/** Test hook (and the "clear" button): turn the cache off / on. */
export function setAiCacheEnabled(on: boolean) { enabled = on; }

/** Hex SHA-256 of the request (FNV-1a when no WebCrypto). */
export async function cacheKey(p: CacheKeyParts): Promise<string> {
  const text = JSON.stringify([p.model, p.effort, p.system, p.messages, p.schema ?? null]);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `fnv${(h >>> 0).toString(16)}-${text.length}`;
}

// ---- IndexedDB (browser only; node and blocked storage fall back to memory)
let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

async function dbGet(key: string): Promise<CachedAnswer | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => { const v = req.result as (CachedAnswer & { at: number }) | undefined; resolve(v ? { text: v.text, reasoning: v.reasoning } : undefined); };
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

async function dbPut(key: string, v: CachedAnswer): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    const tx = d.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({ ...v, at: Date.now() }, key);
    // keep the newest MAX_ENTRIES (the keys come back unordered: read their times)
    const all = store.getAll();
    const keys = store.getAllKeys();
    all.onsuccess = () => {
      if (all.result.length <= MAX_ENTRIES) return;
      const rows = (all.result as { at: number }[]).map((r, i) => ({ at: r.at, key: keys.result?.[i] }));
      rows.sort((a, b) => a.at - b.at).slice(0, rows.length - MAX_ENTRIES).forEach((r) => { if (r.key !== undefined) store.delete(r.key); });
    };
  } catch { /* storage blocked or full */ }
}

/** Forget every stored answer (Settings). */
export async function clearAiCache(): Promise<void> {
  memory.clear();
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); } catch { resolve(); }
  });
}

export type CacheHit = 'memory' | 'stored' | 'shared' | null;

/**
 * Answer from the cache, join a request already running, or run `fn` and store its answer.
 * `fresh` skips reading (the answer is still stored). Resolves with where the answer came from.
 */
export async function cachedAnswer(parts: CacheKeyParts, fn: () => Promise<CachedAnswer>, opts: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<{ answer: CachedAnswer; hit: CacheHit }> {
  if (!enabled) return { answer: await fn(), hit: null };
  const key = await cacheKey(parts);
  if (!opts.fresh) {
    const m = memory.get(key);
    if (m) { memory.delete(key); memory.set(key, m); return { answer: m, hit: 'memory' }; }
    const running = inflight.get(key);
    if (running) {
      // the request it joins may be cancelled by its own caller: then ask itself
      try { return { answer: await running, hit: 'shared' }; } catch (err) { if (opts.signal?.aborted) throw err; }
    }
    const stored = await dbGet(key);
    if (stored) { remember(key, stored); return { answer: stored, hit: 'stored' }; }
  }
  const p = fn();
  inflight.set(key, p);
  try {
    const answer = await p;
    remember(key, answer);
    void dbPut(key, answer);
    return { answer, hit: null };
  } finally {
    if (inflight.get(key) === p) inflight.delete(key);
  }
}

function remember(key: string, v: CachedAnswer) {
  memory.set(key, v);
  if (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
}
