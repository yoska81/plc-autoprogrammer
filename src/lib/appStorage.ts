import type { PersistStorage, StorageValue } from 'zustand/middleware';
/**
 * Where the app keeps its projects. The browser's localStorage holds about 5–10 MB, and a big imported program
 * (thousands of rungs) does not fit: it was lost on restart. Now every value is also kept in IndexedDB (no such
 * limit; the same in the desktop app), and the app reads and writes a copy in memory, loaded before the stores
 * start, so the stores still save and load at once as they did with localStorage.
 *
 * localStorage stays the list of what exists: each value is written there too when it fits, and a short
 * placeholder when it does not (the value is then only in IndexedDB). So clearing localStorage still starts
 * the app clean, a value written straight into localStorage (an older version of the app, a test) is used, and
 * a value whose IndexedDB copy was not written before the app closed is still in localStorage when it fit.
 *
 * Until loadAppStorage() has run (Node tests, a page that cannot open IndexedDB) everything goes to localStorage,
 * as before.
 */

/** IndexedDB, or what a test gives instead. */
export interface StorageBackend {
  readAll(): Promise<Map<string, string>>;
  put(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** In localStorage: the value is in IndexedDB (too big for localStorage). */
export const IN_IDB = '\u0000in-indexeddb';
/** In localStorage: this localStorage belongs with the IndexedDB copy (gone when localStorage is cleared). */
export const MARKER_KEY = 'isa-storage';
const MARKER = 'indexeddb-1';
/** Writes to IndexedDB wait this long for more changes to the same value (the stores save on every change). */
const WRITE_DELAY_MS = 300;
/** Longer values are not tried in localStorage (it holds about 5 million characters in all). */
const LS_MAX_CHARS = 4_000_000;

let mem: Map<string, string> | null = null;
let backend: StorageBackend | null = null;
const pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;
let onFailure: (err: unknown) => void = () => {};

const ls = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** The app's storage, for the stores (zustand createJSONStorage) and the project list. */
export const appStorage = {
  getItem(key: string): string | null {
    if (mem) return mem.get(key) ?? null;
    return ls()?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    if (!mem) { ls()?.setItem(key, value); return; }
    mem.set(key, value);
    mirror(key, value);
    queue(key, value);
  },
  removeItem(key: string): void {
    if (!mem) { ls()?.removeItem(key); return; }
    mem.delete(key);
    try { ls()?.removeItem(key); } catch { /* storage blocked */ }
    queue(key, null);
  },
  keys(): string[] {
    if (mem) return [...mem.keys()];
    const s = ls();
    try { return s ? Object.keys(s).filter((k) => k !== MARKER_KEY) : []; } catch { return []; }
  },
};

/** The localStorage copy: the value when it fits, else the placeholder (after freeing the old value). */
function mirror(key: string, value: string): void {
  const s = ls();
  if (!s) return;
  if (value.length <= LS_MAX_CHARS) try { s.setItem(key, value); return; } catch { /* too big: placeholder below */ }
  try { s.removeItem(key); s.setItem(key, IN_IDB); } catch { /* localStorage full: the marker keeps the IndexedDB copy */ }
}

function queue(key: string, value: string | null): void {
  pending.set(key, value);
  if (!timer) timer = setTimeout(() => void flushAppStorage(), WRITE_DELAY_MS);
}

/** Write what is waiting to IndexedDB now (also when the page is closing). */
export async function flushAppStorage(): Promise<void> {
  // the stores' waiting states as JSON first (appStorage.setItem queues their IndexedDB writes)
  const waiting = [...states];
  states.clear();
  for (const [k, v] of waiting) appStorage.setItem(k, JSON.stringify(v));
  if (timer) { clearTimeout(timer); timer = null; }
  if (!backend || !pending.size) return;
  const writes = [...pending];
  pending.clear();
  try {
    await Promise.all(writes.map(([k, v]) => (v === null ? backend!.remove(k) : backend!.put(k, v))));
  } catch (err) {
    onFailure(err);
  }
}

/**
 * Load everything into memory before the stores start: IndexedDB's values, and localStorage's where it has
 * them (written straight there, or not yet in IndexedDB). The first time, localStorage's values are copied to
 * IndexedDB. Rejects (and the app stays on localStorage) when IndexedDB cannot be opened.
 */
export async function loadAppStorage(opts: { backend?: StorageBackend; onFailure?: (err: unknown) => void } = {}): Promise<void> {
  const b = opts.backend ?? (await indexedDbBackend());
  const stored = await b.readAll();
  const s = ls();
  const lsKeys = s ? Object.keys(s).filter((k) => k !== MARKER_KEY) : [];
  const inLs = new Set(lsKeys);
  // localStorage cleared since the last start (or never used with IndexedDB): what only IndexedDB has is old.
  const cleared = s?.getItem(MARKER_KEY) !== MARKER;
  const out = new Map<string, string>();
  const toIdb: [string, string][] = [];
  const stale: string[] = [];
  for (const k of lsKeys) {
    const v = s!.getItem(k);
    if (v === null) continue;
    if (v === IN_IDB) { const i = stored.get(k); if (i !== undefined) out.set(k, i); continue; }
    out.set(k, v);
    if (stored.get(k) !== v) toIdb.push([k, v]);
  }
  for (const [k, v] of stored) {
    if (inLs.has(k)) continue;
    if (cleared) stale.push(k); else out.set(k, v); // a placeholder that could not be written
  }
  try { s?.setItem(MARKER_KEY, MARKER); } catch { /* full: values stay in both */ }
  await Promise.all([...toIdb.map(([k, v]) => b.put(k, v)), ...stale.map((k) => b.remove(k))]);
  mem = out;
  backend = b;
  onFailure = opts.onFailure ?? onFailure;
  // a page closing writes what is waiting at once
  globalThis.addEventListener?.('pagehide', () => void flushAppStorage());
  globalThis.addEventListener?.('visibilitychange', () => { if (globalThis.document?.visibilityState === 'hidden') void flushAppStorage(); });
}

/** Back to localStorage only (tests). */
export function resetAppStorage(): void {
  mem = null; backend = null; pending.clear(); states.clear();
  if (timer) { clearTimeout(timer); timer = null; }
}

const DB = 'isa-auto-programmer';
const STORE = 'kv';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

async function indexedDbBackend(): Promise<StorageBackend> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
  const open = indexedDB.open(DB, 1);
  open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE); };
  const db = await req(open);
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  const done = (t: IDBObjectStore) => new Promise<void>((resolve, reject) => { t.transaction.oncomplete = () => resolve(); t.transaction.onerror = () => reject(t.transaction.error); t.transaction.onabort = () => reject(t.transaction.error); });
  return {
    async readAll() {
      const store = tx('readonly');
      const [keys, values] = await Promise.all([req(store.getAllKeys()), req(store.getAll())]);
      return new Map(keys.map((k, i) => [String(k), String(values[i])]));
    },
    async put(key, value) { const t = tx('readwrite'); t.put(value, key); await done(t); },
    async remove(key) { const t = tx('readwrite'); t.delete(key); await done(t); },
  };
}

/** Stores' states waiting to be turned into JSON (a burst of changes is written once). */
const states = new Map<string, StorageValue<unknown>>();

/**
 * The `storage` of every persisted store: JSON in appStorage. Once loaded, a state is turned into JSON when the
 * changes stop for a moment (a big program is tens of MB of JSON, and the stores save on every change), and
 * at once when the page closes.
 */
export const appPersistStorage = <S,>(): PersistStorage<S> => ({
  getItem: (name) => {
    const waiting = states.get(name);
    if (waiting) return waiting as StorageValue<S>;
    const text = appStorage.getItem(name);
    return text === null ? null : (JSON.parse(text) as StorageValue<S>);
  },
  setItem: (name, value) => {
    if (!mem) { appStorage.setItem(name, JSON.stringify(value)); return; }
    states.set(name, value);
    if (!timer) timer = setTimeout(() => void flushAppStorage(), WRITE_DELAY_MS);
  },
  removeItem: (name) => { states.delete(name); appStorage.removeItem(name); },
});
